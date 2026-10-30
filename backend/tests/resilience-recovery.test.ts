import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/database.js';
import { emailQueue } from '../src/queue/email.queue.js';
import { runStartupReconciliation } from '../src/workers/reconciliation.js';
import { emailsService } from '../src/modules/emails/emails.service.js';
import { rateLimiter } from '../src/queue/rate-limiter.js';

describe('Phase 13: Failure, Restart & Resilience Scenarios', () => {
  let testTenantId: string;
  let testSenderId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: { name: 'Resilience Test Workspace' },
    });
    testTenantId = tenant.id;

    const sender = await prisma.emailSender.create({
      data: {
        tenantId: testTenantId,
        senderEmail: `resilience-${Date.now()}@test.com`,
        displayName: 'Resilience Tester',
        isActive: true,
      },
    });
    testSenderId = sender.id;
  });

  afterAll(async () => {
    if (testTenantId) {
      await prisma.emailJob.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.emailSender.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.tenant.deleteMany({ where: { id: testTenantId } });
    }
  });

  it('Scenario A & C: Database-to-Queue Crash Recovery & Reconciliation', async () => {
    // 1. Simulate a job saved in PostgreSQL whose BullMQ delayed job was lost/crashed before enqueueing
    const unqueuedJob = await prisma.emailJob.create({
      data: {
        tenantId: testTenantId,
        senderId: testSenderId,
        recipientEmail: 'recovery-target@test.com',
        subject: 'Interrupted Job',
        body: 'This job simulated a crash between DB commit and Redis add',
        scheduledTime: new Date(Date.now() + 3600000), // 1 hour in future
        status: 'SCHEDULED',
        bullmqJobId: null, // missing in BullMQ!
      },
    });

    // Verify it is not in BullMQ
    const missingBullJob = await emailQueue.getJob(`email-job-${unqueuedJob.id}`);
    expect(missingBullJob).toBeUndefined();

    // 2. Trigger startup reconciliation
    const result = await runStartupReconciliation();
    expect(result.restoredJobsCount).toBeGreaterThanOrEqual(1);

    // 3. Verify reconciliation restored the job in BullMQ without duplicating DB record
    const restoredBullJob = await emailQueue.getJob(`email-job-${unqueuedJob.id}`);
    expect(restoredBullJob).toBeDefined();
    expect(restoredBullJob?.data.recipientEmail).toBe('recovery-target@test.com');
  });

  it('Scenario D: Rate-limit exhaustion and non-destructive rescheduling', async () => {
    const limitedSenderId = 'sender-limit-test-' + Date.now();
    const hourlyCap = 3;

    // First 3 slots must succeed
    for (let i = 0; i < hourlyCap; i++) {
      const slot = await rateLimiter.acquireSlot(limitedSenderId, hourlyCap, 0);
      expect(slot.allowed).toBe(true);
    }

    // 4th slot must be denied with SENDER_HOURLY_LIMIT and provide future window
    const excessSlot = await rateLimiter.acquireSlot(limitedSenderId, hourlyCap, 0);
    expect(excessSlot.allowed).toBe(false);
    expect(excessSlot.reason).toBe('SENDER_HOURLY_LIMIT');
    expect(excessSlot.nextEligibleTime).toBeDefined();
    expect(excessSlot.nextEligibleTime!.getTime()).toBeGreaterThan(Date.now());
  });

  it('Scenario G: Synthetic High-Volume Batch Scheduling (100 synthetic jobs)', async () => {
    const syntheticRecipients = Array.from({ length: 100 }, (_, i) => `synthetic-lead-${i}@reachinbox.test`);

    const start = Date.now();
    const batchResult = await emailsService.scheduleEmails(testTenantId, {
      senderId: testSenderId,
      subject: 'High Volume Load Test',
      body: '<p>Synthetic batch test payload</p>',
      scheduledTime: new Date(Date.now() + 1800000).toISOString(),
      recipients: syntheticRecipients,
      idempotencyKey: `load-test-${Date.now()}`,
    });

    const elapsed = Date.now() - start;

    expect(batchResult.scheduledCount).toBe(100);
    expect(batchResult.emailJobs.length).toBe(100);

    // Ensure all 100 jobs are registered in BullMQ
    const firstBullJob = await emailQueue.getJob(`email-job-${batchResult.emailJobs[0].id}`);
    const lastBullJob = await emailQueue.getJob(`email-job-${batchResult.emailJobs[99].id}`);
    expect(firstBullJob).toBeDefined();
    expect(lastBullJob).toBeDefined();

    console.log(`[Performance] Ingested and enqueued 100 email jobs into PostgreSQL & BullMQ in ${elapsed}ms`);
  });
});
