import { Request, Response, NextFunction } from 'express';
import { slackService } from '../../integrations/slack.service.js';
import { env } from '../../config/env.js';

export class SlackController {
  startConnect(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!slackService.isConfigured()) {
        res.status(400).json({
          error: 'Slack credentials not configured. Please supply SLACK_CLIENT_ID and SLACK_CLIENT_SECRET in .env',
          code: 'SLACK_NOT_CONFIGURED',
        });
        return;
      }
      const url = slackService.getAuthorizeUrl(req.user!.tenantId);
      res.redirect(url);
    } catch (error) {
      next(error);
    }
  }

  async handleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state, error } = req.query;

      if (error) {
        res.redirect(`${env.CLIENT_BASE_URL}/dashboard?slack_error=${encodeURIComponent(String(error))}`);
        return;
      }

      if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
        res.redirect(`${env.CLIENT_BASE_URL}/dashboard?slack_error=missing_parameters`);
        return;
      }

      await slackService.handleCallback(code, state);
      res.redirect(`${env.CLIENT_BASE_URL}/dashboard?slack_connected=true`);
    } catch (err) {
      next(err);
    }
  }

  async getConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const info = await slackService.getConnection(req.user!.tenantId);
      res.json(info);
    } catch (error) {
      next(error);
    }
  }

  async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await slackService.disconnect(req.user!.tenantId);
      res.json({ message: 'Slack disconnected successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const slackController = new SlackController();
