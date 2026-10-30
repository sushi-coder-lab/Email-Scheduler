import { prisma } from '../../config/database.js';
import { enqueueEmailJob, emailQueue } from '../../queue/email.queue.js';
import { searchService } from '../search/search.service.js';
import { ScheduleEmailInput, EmailListQuery } from './emails.schema.js';
import { AppError } from '../../middleware/error.middleware.js';
import { logger } from '../../config/logger.js';
import { Prisma } from '@prisma/client';

export class EmailsService {
  /**
   * Schedules email jobs with idempotency and transactional outbox
   */
  async scheduleEmails(
    tenantId: string,
    input: ScheduleEmailInput,
    correlationId?: string
  ) {
    // 1. Check idempotency
    if (input.idempotencyKey) {
      const existingJobs = await prisma.emailJob.findMany({
        where: {
          tenantId,
          OR: [
            { idempotencyKey: input.idempotencyKey },
            { idempotencyKey: { startsWith: `${input.idempotencyKey}-` } },
          ],
        },
        include: { sender: true },
      });

      if (existingJobs.length > 0) {
        logger.info({ idempotencyKey: input.idempotencyKey }, 'Idempotent request detected. Returning existing jobs.');
        return {
          idempotent: true,
          scheduledCount: existingJobs.length,
          emailJobs: existingJobs,
        };
      }
    }

    // 2. Validate sender belongs to tenant
    const sender = await prisma.emailSender.findFirst({
      where: { id: input.senderId, tenantId, isActive: true },
    });

    if (!sender) {
      throw new AppError('Authorized sender not found or inactive', 400, 'INVALID_SENDER');
    }

    // 3. Deduplicate recipients within this request
    const uniqueRecipients = Array.from(
      new Set(input.recipients.map((e) => e.toLowerCase().trim()))
    );

    if (uniqueRecipients.length === 0) {
      throw new AppError('No valid recipients to schedule', 400, 'NO_RECIPIENTS');
    }

    const scheduledDate = new Date(input.scheduledTime);
    const now = Date.now();
    const baseDelayMs = Math.max(0, scheduledDate.getTime() - now);

    // 4. Persist EmailJob records in PostgreSQL
    const createdJobs = await prisma.$transaction(async (tx) => {
      const jobs = [];

      for (let i = 0; i < uniqueRecipients.length; i++) {
        const recipient = uniqueRecipients[i];
        const jobKey = input.idempotencyKey ? `${input.idempotencyKey}-${i}` : undefined;

        const emailRecord = await tx.emailJob.create({
          data: {
            tenantId,
            campaignId: input.campaignId,
            senderId: input.senderId,
            recipientEmail: recipient,
            subject: input.subject,
            body: input.body,
            scheduledTime: scheduledDate,
            status: 'SCHEDULED',
            idempotencyKey: jobKey,
            correlationId,
          },
        });

        jobs.push(emailRecord);
      }

      // Record outbox event
      await tx.outboxEvent.create({
        data: {
          tenantId,
          aggregateType: 'EMAIL_JOB',
          aggregateId: input.campaignId || jobs[0].id,
          eventType: 'SCHEDULED',
          payload: { count: jobs.length, jobIds: jobs.map((j) => j.id) },
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });

      return jobs;
    });

    // 5. Enqueue delayed jobs into BullMQ
    for (const job of createdJobs) {
      const bullJob = await enqueueEmailJob(
        {
          emailJobId: job.id,
          tenantId: job.tenantId,
          senderId: job.senderId,
          recipientEmail: job.recipientEmail,
          subject: job.subject,
          body: job.body,
          scheduledTime: job.scheduledTime.toISOString(),
          attempt: 0,
          correlationId,
          customMinDelayMs: input.customMinDelayMs,
          customHourlyLimit: input.customHourlyLimit,
        },
        baseDelayMs
      );

      // Update bullmqJobId on record
      await prisma.emailJob.update({
        where: { id: job.id },
        data: { bullmqJobId: bullJob.id },
      });
    }

    // 6. Asynchronously index documents in search
    searchService.bulkIndex(
      createdJobs.map((j) => ({
        ...j,
        sender: { senderEmail: sender.senderEmail },
      }))
    ).catch((err) => {
      logger.warn({ err }, 'Async search indexing encountered error');
    });

    logger.info(
      {
        count: createdJobs.length,
        tenantId,
        scheduledTime: scheduledDate.toISOString(),
      },
      'Batch scheduled successfully'
    );

    return {
      scheduledCount: createdJobs.length,
      emailJobs: createdJobs,
    };
  }

  /**
   * Lists scheduled / pending emails
   */
  async listScheduledEmails(tenantId: string, query: EmailListQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.EmailJobWhereInput = {
      tenantId,
      status: {
        in: ['SCHEDULED', 'QUEUED', 'PROCESSING', 'RETRYING'],
      },
      ...(query.senderId ? { senderId: query.senderId } : {}),
      ...(query.campaignId ? { campaignId: query.campaignId } : {}),
    };

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { recipientEmail: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledTime: 'asc' },
        include: {
          sender: { select: { displayName: true, senderEmail: true } },
          campaign: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Lists sent / finished / failed emails
   */
  async listSentEmails(tenantId: string, query: EmailListQuery) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const statusFilter = query.status
      ? { status: query.status }
      : { status: { in: ['SENT', 'FAILED', 'CANCELLED', 'DELIVERY_UNKNOWN'] } };

    const where: Prisma.EmailJobWhereInput = {
      tenantId,
      ...statusFilter,
      ...(query.senderId ? { senderId: query.senderId } : {}),
      ...(query.campaignId ? { campaignId: query.campaignId } : {}),
    };

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { recipientEmail: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          sender: { select: { displayName: true, senderEmail: true } },
          campaign: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single email record
   */
  async getEmailById(tenantId: string, id: string) {
    const email = await prisma.emailJob.findFirst({
      where: { id, tenantId },
      include: {
        sender: true,
        campaign: true,
      },
    });

    if (!email) {
      throw new AppError('Email record not found', 404, 'EMAIL_NOT_FOUND');
    }

    return email;
  }

  /**
   * Cancels a scheduled or queued email job safely
   */
  async cancelEmail(tenantId: string, id: string) {
    const email = await prisma.emailJob.findFirst({
      where: { id, tenantId },
    });

    if (!email) {
      throw new AppError('Email not found', 404, 'EMAIL_NOT_FOUND');
    }

    if (!['SCHEDULED', 'QUEUED'].includes(email.status)) {
      throw new AppError(
        `Cannot cancel email in '${email.status}' state. Cancellation is only safe before sending has begun.`,
        400,
        'CANNOT_CANCEL'
      );
    }

    // Remove from BullMQ
    if (email.bullmqJobId) {
      try {
        const job = await emailQueue.getJob(email.bullmqJobId);
        if (job) {
          await job.remove();
        }
      } catch (err) {
        logger.warn({ err, jobId: email.bullmqJobId }, 'BullMQ job remove error (job may have already moved)');
      }
    }

    // Update database status
    const updated = await prisma.emailJob.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
      include: { sender: true },
    });

    // Update search index
    searchService.indexEmail(updated).catch(() => {});

    logger.info({ id, tenantId }, 'Email job cancelled successfully');
    return updated;
  }

  /**
   * Retrieves dashboard summary metrics
   */
  async getDashboardMetrics(tenantId: string) {
    const [scheduledCount, sentCount, failedCount, activeCount] = await Promise.all([
      prisma.emailJob.count({
        where: { tenantId, status: { in: ['SCHEDULED', 'QUEUED'] } },
      }),
      prisma.emailJob.count({
        where: { tenantId, status: 'SENT' },
      }),
      prisma.emailJob.count({
        where: { tenantId, status: 'FAILED' },
      }),
      prisma.emailJob.count({
        where: { tenantId, status: { in: ['PROCESSING', 'RETRYING'] } },
      }),
    ]);

    // BullMQ stats
    const [waitingJobs, delayedJobs, activeJobs] = await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getDelayedCount(),
      emailQueue.getActiveCount(),
    ]);

    return {
      scheduledCount,
      sentCount,
      failedCount,
      processingCount: activeCount,
      queue: {
        waiting: waitingJobs,
        delayed: delayedJobs,
        active: activeJobs,
      },
    };
  }
}

export const emailsService = new EmailsService();
