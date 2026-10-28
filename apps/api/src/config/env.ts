import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from cwd or root workspace
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const parseBool = (defaultValue = false) =>
  z.preprocess((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      const lower = val.trim().toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') return true;
      if (lower === 'false' || lower === '0' || lower === 'no') return false;
    }
    return defaultValue;
  }, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().default('http://localhost:4000'),
  CLIENT_BASE_URL: z.string().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(16).default('reachinbox_super_secret_session_encryption_key_32_bytes_min!'),
  COOKIE_SECRET: z.string().min(16).default('reachinbox_cookie_secret_key_needs_32_chars_minimum!'),

  // PostgreSQL
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost/reachinbox?host=/tmp'),

  // Redis
  REDIS_SOCKET: z.string().optional().default('/tmp/redis.sock'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.coerce.number().default(0),

  // Concurrency & Rate Limiting
  WORKER_CONCURRENCY: z.coerce.number().min(1).max(50).default(5),
  MIN_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().min(100).max(60000).default(2000),
  MAX_EMAILS_PER_HOUR_GLOBAL: z.coerce.number().min(1).default(200),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().min(1).default(100),

  // Ethereal SMTP
  ETHEREAL_USER: z.string().optional().default(''),
  ETHEREAL_PASS: z.string().optional().default(''),
  SMTP_HOST: z.string().default('smtp.ethereal.email'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: parseBool(false),

  // Google OAuth 2.0
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:4000/api/auth/google/callback'),

  // Slack OAuth & Alerts
  SLACK_CLIENT_ID: z.string().optional().default(''),
  SLACK_CLIENT_SECRET: z.string().optional().default(''),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:4000/api/slack/callback'),
  SLACK_ENCRYPTION_KEY: z.string().min(32).default('reachinbox_slack_aes256_encryption_key_32_bytes_min!!'),
  SLACK_DEFAULT_CHANNEL: z.string().default('#email-alerts'),

  // Elasticsearch
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
  ELASTICSEARCH_INDEX: z.string().default('reachinbox-emails'),

  // Bull Board
  ENABLE_BULL_BOARD: parseBool(true),
  BULL_BOARD_PATH: z.string().default('/api/admin/queues'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables at startup:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
