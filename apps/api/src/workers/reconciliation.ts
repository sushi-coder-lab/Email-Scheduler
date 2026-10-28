import { prisma } from '../config/database.js';
import { emailQueue, enqueueEmailJob } from '../queue/email.queue.js';
import { logger } from '../config/logger.js';

export async function runStartupReconciliation(): Promise<{ restoredJobsCount: number }> {
  logger.info('Starting startup reconciliation check for unqueued or interrupted jobs...');

  // 1. Find all pending jobs in PostgreSQL
  const pendingJobs = await prisma.emailJob.findMany({
    where: {
      status: {
        in: ['SCHEDULED', 'QUEUED', 'RETRYING'],
      },
    },
    take: 5000,
  });

  let restoredCount = 0;
  const now = Date.now();

  for (const job of pendingJobs) {
    const expectedBullJobId = `email-job-${job.id}`;

    try {
      const existingBullJob = await emailQueue.getJob(expectedBullJobId);

      // If missing or completed, restore delayed job
      if (!existingBullJob) {
        const targetTime = job.scheduledTime.getTime();
        const delayMs = Math.max(0, targetTime - now);

        await enqueueEmailJob(
          {
            emailJobId: job.id,
            tenantId: job.tenantId,
            senderId: job.senderId,
            recipientEmail: job.recipientEmail,
            subject: job.subject,
            body: job.body,
            scheduledTime: job.scheduledTime.toISOString(),
            attempt: job.attemptCount,
            correlationId: job.correlationId || undefined,
          },
          delayMs
        );

        restoredCount++;
      }
    } catch (err) {
      logger.warn({ err, jobId: job.id }, 'Error during reconciliation for job');
    }
  }

  // 2. Check pending outbox events
  const pendingOutbox = await prisma.outboxEvent.findMany({
    where: { status: 'PENDING' },
    take: 100,
  });

  for (const event of pendingOutbox) {
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });
  }

  logger.info(
    { totalPending: pendingJobs.length, restoredCount, outboxProcessed: pendingOutbox.length },
    'Startup reconciliation completed successfully'
  );

  return { restoredJobsCount: restoredCount };
}
