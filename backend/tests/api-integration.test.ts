import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { emailQueue } from '../src/queue/email.queue.js';

describe('ReachInbox API End-to-End Integration', () => {
  let authCookie: string;
  let tenantId: string;
  let senderId: string;
  let scheduledEmailId: string;

  beforeAll(async () => {
    // 1. Authenticate via dev-login to obtain signed session cookie
    const loginRes = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'integration-test@reachinbox.ai' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.headers['set-cookie']).toBeDefined();

    authCookie = loginRes.headers['set-cookie'][0];
    tenantId = loginRes.body.tenant.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    if (tenantId) {
      await prisma.emailJob.deleteMany({ where: { tenantId } });
      await prisma.campaign.deleteMany({ where: { tenantId } });
      await prisma.emailSender.deleteMany({ where: { tenantId } });
      await prisma.tenantMembership.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it('GET /api/health returns 200 with service status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.services.database).toBe('connected');
    expect(res.body.services.redis).toBe('connected');
  });

  it('GET /api/auth/me returns authenticated user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('integration-test@reachinbox.ai');
    expect(res.body.tenant.id).toBe(tenantId);
  });

  it('POST & GET /api/senders manages authorized senders', async () => {
    // Create sender
    const createRes = await request(app)
      .post('/api/senders')
      .set('Cookie', authCookie)
      .send({
        senderEmail: 'sales@reachinbox.ai',
        displayName: 'ReachInbox Sales Team',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.sender.senderEmail).toBe('sales@reachinbox.ai');
    senderId = createRes.body.sender.id;

    // List senders
    const listRes = await request(app)
      .get('/api/senders')
      .set('Cookie', authCookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.senders.length).toBeGreaterThanOrEqual(1);
  });

  it('POST & GET /api/campaigns creates campaign', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('Cookie', authCookie)
      .send({
        name: 'Q4 Product Announcement',
        subject: 'Discover ReachInbox 2.0',
        body: '<p>Exciting new features available today!</p>',
        senderId,
        startTime: new Date(Date.now() + 3600000).toISOString(),
        minDelayMs: 1500,
        hourlyLimit: 50,
      });

    expect(res.status).toBe(201);
    expect(res.body.campaign.name).toBe('Q4 Product Announcement');

    // List campaigns
    const listRes = await request(app)
      .get('/api/campaigns')
      .set('Cookie', authCookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.campaigns.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/emails/schedule enqueues delayed email jobs and enforces idempotency', async () => {
    const idempotencyKey = 'test-idemp-' + Date.now();
    const scheduledTime = new Date(Date.now() + 7200000).toISOString(); // 2 hours in future

    // First request
    const res1 = await request(app)
      .post('/api/emails/schedule')
      .set('Cookie', authCookie)
      .send({
        senderId,
        subject: 'Welcome to ReachInbox',
        body: '<p>Hello world!</p>',
        scheduledTime,
        recipients: ['lead1@test.com', 'lead2@test.com'],
        idempotencyKey,
      });

    expect(res1.status).toBe(201);
    expect(res1.body.scheduledCount).toBe(2);
    expect(res1.body.emailJobs.length).toBe(2);
    scheduledEmailId = res1.body.emailJobs[0].id;

    // Verify BullMQ delayed job exists
    const bullJob = await emailQueue.getJob(`email-job-${scheduledEmailId}`);
    expect(bullJob).toBeDefined();

    // Repeated request with same idempotency key must return existing without duplicates
    const res2 = await request(app)
      .post('/api/emails/schedule')
      .set('Cookie', authCookie)
      .send({
        senderId,
        subject: 'Welcome to ReachInbox',
        body: '<p>Hello world!</p>',
        scheduledTime,
        recipients: ['lead1@test.com', 'lead2@test.com'],
        idempotencyKey,
      });

    expect(res2.status).toBe(201);
    expect(res2.body.idempotent).toBe(true);
  });

  it('GET /api/emails/scheduled returns scheduled records', async () => {
    const res = await request(app)
      .get('/api/emails/scheduled')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
    expect(res.body.items[0].status).toBe('SCHEDULED');
  });

  it('POST /api/emails/:id/cancel safely cancels a scheduled email', async () => {
    const res = await request(app)
      .post(`/api/emails/${scheduledEmailId}/cancel`)
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.email.status).toBe('CANCELLED');

    // Confirm it now appears under cancelled / sent endpoint
    const sentList = await request(app)
      .get('/api/emails/sent')
      .set('Cookie', authCookie);

    expect(sentList.status).toBe(200);
    const cancelledItem = sentList.body.items.find((i: { id: string }) => i.id === scheduledEmailId);
    expect(cancelledItem).toBeDefined();
    expect(cancelledItem.status).toBe('CANCELLED');
  });

  it('Enforces multi-tenant isolation', async () => {
    // Login as a second user with different tenant
    const otherLogin = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'other-tenant@reachinbox.ai' });

    const otherCookie = otherLogin.headers['set-cookie'][0];
    const otherTenantId = otherLogin.body.tenant.id;

    expect(otherTenantId).not.toBe(tenantId);

    // Other user attempts to view the first tenant's email details
    const res = await request(app)
      .get(`/api/emails/${scheduledEmailId}`)
      .set('Cookie', otherCookie);

    // Must be 404 Not Found to prevent data leakage across tenants
    expect(res.status).toBe(404);

    // Cleanup second tenant
    await prisma.tenantMembership.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
  });
});
