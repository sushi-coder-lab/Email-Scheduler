import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rateLimiter } from '../src/queue/rate-limiter.js';
import { redis } from '../src/config/redis.js';

describe('Distributed Rate Limiter (Redis Lua)', () => {
  const testSenderId = 'test-sender-uuid-' + Date.now();

  beforeAll(async () => {
    // Clear any test keys in Redis
    const keys = await redis.keys(`ratelimit:*${testSenderId}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  afterAll(async () => {
    const keys = await redis.keys(`ratelimit:*${testSenderId}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  it('allows initial sending slot', async () => {
    const result = await rateLimiter.acquireSlot(testSenderId, 10, 500);
    expect(result.allowed).toBe(true);
  });

  it('enforces minimum delay interval immediately after first send', async () => {
    // Immediate second acquire should be rejected due to MIN_DELAY
    const result = await rateLimiter.acquireSlot(testSenderId, 10, 1000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('MIN_DELAY');
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(1000);
  });

  it('enforces hourly limit when quota is exhausted', async () => {
    const lowLimitSender = 'low-limit-sender-' + Date.now();
    // Limit of 2 emails/hr, min delay 0
    const res1 = await rateLimiter.acquireSlot(lowLimitSender, 2, 0);
    expect(res1.allowed).toBe(true);

    const res2 = await rateLimiter.acquireSlot(lowLimitSender, 2, 0);
    expect(res2.allowed).toBe(true);

    const res3 = await rateLimiter.acquireSlot(lowLimitSender, 2, 0);
    expect(res3.allowed).toBe(false);
    expect(res3.reason).toBe('SENDER_HOURLY_LIMIT');
    expect(res3.nextEligibleTime).toBeDefined();
  });
});
