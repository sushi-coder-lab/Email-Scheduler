import { Redis } from 'ioredis';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import { getHourWindowStart, getNextHourWindowStart } from '../utils/time.js';
import { logger } from '../config/logger.js';

export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: 'MIN_DELAY' | 'SENDER_HOURLY_LIMIT' | 'GLOBAL_HOURLY_LIMIT';
  retryAfterMs?: number;
  nextEligibleTime?: Date;
}

const RATE_LIMIT_LUA_SCRIPT = `
local senderHourlyKey = KEYS[1]
local globalHourlyKey = KEYS[2]
local senderLastSendKey = KEYS[3]

local senderLimit = tonumber(ARGV[1])
local globalLimit = tonumber(ARGV[2])
local minDelayMs = tonumber(ARGV[3])
local nowMs = tonumber(ARGV[4])

-- 1. Check minimum interval between sends for sender
local lastSend = redis.call('GET', senderLastSendKey)
if lastSend and minDelayMs > 0 then
  local diff = nowMs - tonumber(lastSend)
  if diff < minDelayMs then
    local remaining = minDelayMs - diff
    return {0, 'MIN_DELAY', tostring(remaining)}
  end
end

-- 2. Check sender hourly limit
local senderCount = tonumber(redis.call('GET', senderHourlyKey) or '0')
if senderCount >= senderLimit then
  return {0, 'SENDER_HOURLY_LIMIT', '0'}
end

-- 3. Check global hourly limit
local globalCount = tonumber(redis.call('GET', globalHourlyKey) or '0')
if globalCount >= globalLimit then
  return {0, 'GLOBAL_HOURLY_LIMIT', '0'}
end

-- 4. All limits satisfied: reserve atomicity
redis.call('INCR', senderHourlyKey)
redis.call('EXPIRE', senderHourlyKey, 7200)

redis.call('INCR', globalHourlyKey)
redis.call('EXPIRE', globalHourlyKey, 7200)

redis.call('SET', senderLastSendKey, tostring(nowMs), 'EX', 3600)

return {1, 'OK', '0'}
`;

export class DistributedRateLimiter {
  private client: Redis;

  constructor(client = redis) {
    this.client = client;
    this.client.defineCommand('acquireRateLimitSlot', {
      numberOfKeys: 3,
      lua: RATE_LIMIT_LUA_SCRIPT,
    });
  }

  async acquireSlot(
    senderId: string,
    customHourlyLimit?: number,
    customMinDelayMs?: number
  ): Promise<RateLimitCheckResult> {
    const now = new Date();
    const nowMs = now.getTime();
    const windowStart = getHourWindowStart(now).getTime();

    const senderHourlyKey = `ratelimit:sender:${senderId}:${windowStart}`;
    const globalHourlyKey = `ratelimit:global:${windowStart}`;
    const senderLastSendKey = `ratelimit:sender-last-send:${senderId}`;

    const senderLimit = customHourlyLimit !== undefined ? customHourlyLimit : env.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const globalLimit = env.MAX_EMAILS_PER_HOUR_GLOBAL;
    const minDelayMs = customMinDelayMs !== undefined ? customMinDelayMs : env.MIN_DELAY_BETWEEN_EMAILS_MS;

    try {
      // @ts-expect-error custom defined redis command
      const [allowedNum, reason, extra] = await this.client.acquireRateLimitSlot(
        senderHourlyKey,
        globalHourlyKey,
        senderLastSendKey,
        senderLimit,
        globalLimit,
        minDelayMs,
        nowMs
      );

      if (allowedNum === 1) {
        return { allowed: true };
      }

      const nextHourWindow = getNextHourWindowStart(now);

      if (reason === 'MIN_DELAY') {
        const retryAfterMs = Math.max(100, Number(extra));
        return {
          allowed: false,
          reason: 'MIN_DELAY',
          retryAfterMs,
          nextEligibleTime: new Date(nowMs + retryAfterMs),
        };
      }

      if (reason === 'SENDER_HOURLY_LIMIT') {
        const remainingMsInHour = Math.max(1000, nextHourWindow.getTime() - nowMs);
        return {
          allowed: false,
          reason: 'SENDER_HOURLY_LIMIT',
          retryAfterMs: remainingMsInHour,
          nextEligibleTime: nextHourWindow,
        };
      }

      if (reason === 'GLOBAL_HOURLY_LIMIT') {
        const remainingMsInHour = Math.max(1000, nextHourWindow.getTime() - nowMs);
        return {
          allowed: false,
          reason: 'GLOBAL_HOURLY_LIMIT',
          retryAfterMs: remainingMsInHour,
          nextEligibleTime: nextHourWindow,
        };
      }

      return { allowed: false, reason: 'SENDER_HOURLY_LIMIT', nextEligibleTime: nextHourWindow };
    } catch (error) {
      logger.error({ err: error, senderId }, 'Error evaluating rate limit via Redis');
      throw error;
    }
  }

  async getCounts(senderId: string): Promise<{ senderCount: number; globalCount: number }> {
    const now = new Date();
    const windowStart = getHourWindowStart(now).getTime();

    const senderHourlyKey = `ratelimit:sender:${senderId}:${windowStart}`;
    const globalHourlyKey = `ratelimit:global:${windowStart}`;

    const [senderCount, globalCount] = await Promise.all([
      this.client.get(senderHourlyKey),
      this.client.get(globalHourlyKey),
    ]);

    return {
      senderCount: parseInt(senderCount || '0', 10),
      globalCount: parseInt(globalCount || '0', 10),
    };
  }
}

export const rateLimiter = new DistributedRateLimiter();
