import { Worker, Job } from 'bullmq';
import { createRedisClient } from '../config/redis.js';
import { EMAIL_QUEUE_NAME, EmailJobData } from '../queue/queue.types.js';
import { rateLimiter } from '../queue/rate-limiter.js';
import { etherealSmtpService } from '../integrations/ethereal.service.js';
import { slackService } from '../integrations/slack.service.js';
import { prisma } from '../config/database.js';
import { searchService } from '../modules/search/search.service.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { decrypt } from '../utils/crypto.js';
import { enqueueEmailJob } from '../queue/email.queue.js';

export function createEmailWorker(): Worker<EmailJobData> {
  const workerRedis = createRedisClient('bullmq-worker');

  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const data = job.data;
      const correlationId = data.correlationId || job.id;

      logger.info(
        {
          jobId: job.id,
          emailJobId: data.emailJobId,
          recipient: data.recipientEmail,
          attempt: job.attemptsMade + 1,
        },
        'Worker picked up email job'
      );

      if (!data || !data.emailJobId) {
        logger.warn({ jobId: job.id, data }, 'Job missing emailJobId. Skipping invalid job.');
        return { skipped: true, reason: 'INVALID_PAYLOAD' };
      }

      // 1. Fetch current status from database
      const emailRecord = await prisma.emailJob.findUnique({
        where: { id: data.emailJobId },
        include: { sender: true },
      });

      if (!emailRecord) {
        logger.warn({ emailJobId: data.emailJobId }, 'Email record not found in database. Skipping.');
        return { skipped: true, reason: 'RECORD_NOT_FOUND' };
      }

      if (emailRecord.status === 'CANCELLED') {
        logger.info({ emailJobId: data.emailJobId }, 'Email job was cancelled before execution. Skipping.');
        return { skipped: true, reason: 'CANCELLED' };
      }

      if (emailRecord.status === 'SENT') {
        logger.info({ emailJobId: data.emailJobId }, 'Email job already sent. Skipping duplicate delivery.');
        return { skipped: true, reason: 'ALREADY_SENT' };
      }

      // 2. Check distributed atomic rate limits and min delay
      const limitCheck = await rateLimiter.acquireSlot(
        data.senderId,
        data.customHourlyLimit,
        data.customMinDelayMs
      );

      if (!limitCheck.allowed) {
        // A. Minimum delay required before this sender can send again
        if (limitCheck.reason === 'MIN_DELAY') {
          const delayMs = limitCheck.retryAfterMs || 1000;
          logger.info(
            {
              senderId: data.senderId,
              emailJobId: data.emailJobId,
              delayMs,
            },
            'Minimum send delay interval active. Rescheduling job with delay.'
          );

          // Re-enqueue with remaining delay without failing
          await enqueueEmailJob(data, delayMs);
          return { delayed: true, reason: 'MIN_DELAY', delayMs };
        }

        // B. Hourly limit reached (sender or global)
        const nextWindow = limitCheck.nextEligibleTime || new Date(Date.now() + 3600000);
        const delayUntilNextWindow = Math.max(1000, nextWindow.getTime() - Date.now());

        logger.warn(
          {
            senderId: data.senderId,
            emailJobId: data.emailJobId,
            reason: limitCheck.reason,
            nextEligibleTime: nextWindow.toISOString(),
          },
          'Hourly sending limit reached. Rescheduling job to next eligible hour window.'
        );

        // Update database scheduledTime to keep queue and database consistent
        await prisma.emailJob.update({
          where: { id: data.emailJobId },
          data: {
            scheduledTime: nextWindow,
            status: 'SCHEDULED',
          },
        });

        // Re-enqueue for the start of the next hour window
        await enqueueEmailJob(data, delayUntilNextWindow);

        // Send deduplicated Slack alert
        slackService
          .sendRateLimitAlert({
            tenantId: data.tenantId,
            senderEmail: emailRecord.sender.senderEmail,
            windowStart: new Date(),
            limit: data.customHourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER,
            reason: limitCheck.reason === 'SENDER_HOURLY_LIMIT' ? 'Sender hourly limit reached' : 'Global hourly limit reached',
            correlationId,
          })
          .catch((err) => {
            logger.warn({ err }, 'Background Slack rate-limit alert failed');
          });

        return { rescheduled: true, nextEligibleTime: nextWindow.toISOString() };
      }

      // 3. Mark status as PROCESSING
      await prisma.emailJob.update({
        where: { id: data.emailJobId },
        data: {
          status: 'PROCESSING',
          attemptCount: { increment: 1 },
        },
      });

      // 4. Send via Ethereal SMTP
      try {
        let customSmtpConfig = undefined;
        if (emailRecord.sender.providerConfig) {
          const cfg = emailRecord.sender.providerConfig as {
            host?: string;
            port?: number;
            user?: string;
            pass?: string;
          };
          if (cfg.user && cfg.pass) {
            customSmtpConfig = {
              host: cfg.host,
              port: cfg.port,
              user: cfg.user,
              pass: decrypt(cfg.pass),
            };
          }
        }

        const senderAddress = `"${emailRecord.sender.displayName}" <${emailRecord.sender.senderEmail}>`;

        const result = await etherealSmtpService.sendMail(
          {
            from: senderAddress,
            to: data.recipientEmail,
            subject: data.subject,
            html: data.body,
          },
          customSmtpConfig
        );

        // 5. Update database status to SENT
        const updated = await prisma.emailJob.update({
          where: { id: data.emailJobId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            smtpPreviewUrl: result.previewUrl ? String(result.previewUrl) : null,
            lastError: null,
          },
          include: { sender: true },
        });

        // 6. Update search index
        searchService.indexEmail(updated).catch(() => {});

        logger.info(
          {
            emailJobId: data.emailJobId,
            messageId: result.messageId,
            previewUrl: result.previewUrl,
          },
          'Email sent and persisted successfully'
        );

        return {
          success: true,
          messageId: result.messageId,
          previewUrl: result.previewUrl,
        };
      } catch (sendError) {
        const errorMsg = (sendError as Error).message || 'Unknown SMTP error';
        const isPermanent = errorMsg.includes('550') || errorMsg.includes('No recipients') || errorMsg.includes('invalid address');

        if (isPermanent || job.attemptsMade + 1 >= (job.opts.attempts || 5)) {
          // Mark permanently failed
          const updated = await prisma.emailJob.update({
            where: { id: data.emailJobId },
            data: {
              status: 'FAILED',
              lastError: errorMsg,
            },
            include: { sender: true },
          });

          searchService.indexEmail(updated).catch(() => {});
          logger.error({ emailJobId: data.emailJobId, errorMsg }, 'Email sending permanently failed');
          return { failed: true, error: errorMsg };
        } else {
          // Mark retrying
          await prisma.emailJob.update({
            where: { id: data.emailJobId },
            data: {
              status: 'RETRYING',
              lastError: errorMsg,
            },
          });
          logger.warn({ emailJobId: data.emailJobId, errorMsg }, 'Transient SMTP failure. Triggering queue retry.');
          throw sendError;
        }
      }
    },
    {
      connection: workerRedis,
      concurrency: env.WORKER_CONCURRENCY,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'BullMQ worker job failed');
  });

  return worker;
}
