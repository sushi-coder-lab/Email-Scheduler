import { Redis, RedisOptions } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

export function createRedisClient(name = 'default'): Redis {
  const options: RedisOptions = {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: true,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  };

  if (env.REDIS_PASSWORD) {
    options.password = env.REDIS_PASSWORD;
  }
  if (env.REDIS_DB) {
    options.db = env.REDIS_DB;
  }

  let client: Redis;
  if (env.REDIS_SOCKET) {
    client = new Redis(env.REDIS_SOCKET, options);
  } else {
    client = new Redis({
      ...options,
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
    });
  }

  client.on('connect', () => {
    logger.info({ name }, 'Redis connected');
  });

  client.on('error', (err) => {
    logger.error({ name, err: err.message }, 'Redis connection error');
  });

  return client;
}

export const redis = createRedisClient('app-redis');
