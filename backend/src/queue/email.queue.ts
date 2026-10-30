import { Queue, JobsOptions } from 'bullmq';
import { createRedisClient } from '../config/redis.js';
import { EMAIL_QUEUE_NAME, EmailJobData } from './queue.types.js';
import { logger } from '../config/logger.js';

export const emailQueueRedis = createRedisClient('bullmq-queue');

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: emailQueueRedis,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 2000,
    },
    removeOnFail: {
      count: 5000,
    },
  },
});

export async function enqueueEmailJob(
  data: EmailJobData,
  delayMs = 0,
  opts?: Partial<JobsOptions>
) {
  const jobId = `email-job-${data.emailJobId}`;
  const effectiveDelay = Math.max(0, delayMs);

  const job = await emailQueue.add('send-email', data, {
    jobId,
    delay: effectiveDelay,
    ...opts,
  });

  logger.info(
    {
      jobId,
      emailJobId: data.emailJobId,
      delayMs: effectiveDelay,
      recipient: data.recipientEmail,
    },
    'Enqueued email job in BullMQ'
  );

  return job;
}
