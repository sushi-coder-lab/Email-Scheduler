import { WebClient } from '@slack/web-api';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { decrypt, encrypt, sign, unsign } from '../utils/crypto.js';
import { logger } from '../config/logger.js';
import { AppError } from '../middleware/error.middleware.js';

export interface SlackConnectionInfo {
  connected: boolean;
  teamName?: string;
  channelName?: string;
  createdAt?: Date;
}

export class SlackService {
  isConfigured(): boolean {
    return Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET);
  }

  getAuthorizeUrl(tenantId: string): string {
    if (!this.isConfigured()) {
      throw new AppError('Slack integration credentials not configured in .env', 500, 'SLACK_NOT_CONFIGURED');
    }

    const state = sign(JSON.stringify({ tenantId, timestamp: Date.now() }));
    const scopes = ['chat:write', 'channels:read', 'incoming-webhook'].join(',');

    const url = new URL('https://slack.com/oauth/v2/authorize');
    url.searchParams.set('client_id', env.SLACK_CLIENT_ID!);
    url.searchParams.set('scope', scopes);
    url.searchParams.set('redirect_uri', env.SLACK_REDIRECT_URI);
    url.searchParams.set('state', state);

    return url.toString();
  }

  async handleCallback(code: string, state: string): Promise<void> {
    const rawState = unsign(state);
    if (!rawState) {
      throw new AppError('Invalid or expired OAuth state', 400, 'INVALID_STATE');
    }

    const { tenantId } = JSON.parse(rawState);
    if (!tenantId) {
      throw new AppError('Missing tenant in OAuth state', 400, 'INVALID_STATE_PAYLOAD');
    }

    const client = new WebClient();
    const response = await client.oauth.v2.access({
      client_id: env.SLACK_CLIENT_ID!,
      client_secret: env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    });

    if (!response.ok || !response.access_token) {
      logger.error({ response }, 'Slack OAuth token exchange failed');
      throw new AppError(`Slack OAuth error: ${response.error || 'Token missing'}`, 400, 'SLACK_EXCHANGE_FAILED');
    }

    const encryptedToken = encrypt(response.access_token);
    const teamId = (response.team as { id?: string })?.id || 'unknown';
    const teamName = (response.team as { name?: string })?.name || 'Slack Workspace';
    const incomingWebhook = response.incoming_webhook as { url?: string; channel?: string } | undefined;

    await prisma.slackConnection.upsert({
      where: { tenantId },
      update: {
        encryptedToken,
        teamId,
        teamName,
        channelId: incomingWebhook?.channel,
        channelName: incomingWebhook?.channel || env.SLACK_DEFAULT_CHANNEL,
        incomingWebhookUrl: incomingWebhook?.url,
        status: 'CONNECTED',
      },
      create: {
        tenantId,
        encryptedToken,
        teamId,
        teamName,
        channelId: incomingWebhook?.channel,
        channelName: incomingWebhook?.channel || env.SLACK_DEFAULT_CHANNEL,
        incomingWebhookUrl: incomingWebhook?.url,
        status: 'CONNECTED',
      },
    });

    logger.info({ tenantId, teamName }, 'Connected Slack workspace successfully');
  }

  async getConnection(tenantId: string): Promise<SlackConnectionInfo> {
    const connection = await prisma.slackConnection.findUnique({
      where: { tenantId },
    });

    if (!connection || connection.status !== 'CONNECTED') {
      return { connected: false };
    }

    return {
      connected: true,
      teamName: connection.teamName,
      channelName: connection.channelName || env.SLACK_DEFAULT_CHANNEL,
      createdAt: connection.createdAt,
    };
  }

  async disconnect(tenantId: string): Promise<void> {
    await prisma.slackConnection.deleteMany({
      where: { tenantId },
    });
    logger.info({ tenantId }, 'Disconnected Slack workspace');
  }

  /**
   * Sends a rate-limit alert message to Slack with strict deduplication
   */
  async sendRateLimitAlert(params: {
    tenantId: string;
    senderEmail: string;
    windowStart: Date;
    limit: number;
    reason: string;
    correlationId?: string;
  }): Promise<boolean> {
    const { tenantId, senderEmail, windowStart, limit, reason, correlationId } = params;

    // 1. Check if Slack is connected for this tenant
    const connection = await prisma.slackConnection.findUnique({
      where: { tenantId },
    });

    if (!connection || connection.status !== 'CONNECTED') {
      logger.debug({ tenantId, senderEmail }, 'Slack not connected for tenant, skipping notification');
      return false;
    }

    // 2. Strict deduplication check
    const dedupeKey = `rate-limit:${senderEmail}:${windowStart.getTime()}`;

    try {
      const existing = await prisma.notificationDeduplication.findUnique({
        where: {
          tenantId_dedupeKey_windowStart: {
            tenantId,
            dedupeKey,
            windowStart,
          },
        },
      });

      if (existing) {
        logger.debug({ dedupeKey }, 'Rate-limit alert already sent for this window, deduplicating');
        return false;
      }

      // Record deduplication immediately to prevent race conditions across concurrent workers
      await prisma.notificationDeduplication.create({
        data: {
          tenantId,
          dedupeKey,
          eventType: 'RATE_LIMIT_ALERT',
          windowStart,
        },
      });
    } catch {
      // If unique constraint error occurs, another worker just recorded it
      logger.debug({ dedupeKey }, 'Concurrent worker recorded deduplication row, skipping notification');
      return false;
    }

    // 3. Post alert to Slack
    try {
      const token = decrypt(connection.encryptedToken);
      const client = new WebClient(token);

      const channel = connection.channelId || env.SLACK_DEFAULT_CHANNEL;

      const messageText = `⚠️ *ReachInbox Rate Limit Alert*\n` +
        `• *Sender:* \`${senderEmail}\`\n` +
        `• *Limit Reached:* Hourly cap of ${limit} emails/hr\n` +
        `• *Reason:* ${reason}\n` +
        `• *Window Start:* ${windowStart.toLocaleTimeString()}\n` +
        `• *Action:* Queued emails have been safely rescheduled to the next hourly window. No emails have been dropped.\n` +
        (correlationId ? `• *Correlation ID:* \`${correlationId}\`` : '');

      if (connection.incomingWebhookUrl) {
        const fetchResponse = await fetch(connection.incomingWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: messageText }),
        });
        if (!fetchResponse.ok) {
          throw new Error(`Webhook post failed: ${fetchResponse.statusText}`);
        }
      } else {
        await client.chat.postMessage({
          channel,
          text: messageText,
        });
      }

      logger.info({ tenantId, senderEmail, channel }, 'Sent Slack rate-limit alert');
      return true;
    } catch (error) {
      logger.error({ err: error, tenantId, senderEmail }, 'Failed to deliver Slack notification');
      return false;
    }
  }
}

export const slackService = new SlackService();
