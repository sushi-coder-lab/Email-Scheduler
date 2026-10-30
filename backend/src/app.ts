import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestLogger } from './middleware/request-logger.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { authenticate, requireRole } from './middleware/auth.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { sendersRouter } from './modules/senders/senders.routes.js';
import { campaignsRouter } from './modules/campaigns/campaigns.routes.js';
import { emailsRouter } from './modules/emails/emails.routes.js';
import { slackRouter } from './modules/notifications/slack.routes.js';
import { searchRouter } from './modules/search/search.routes.js';
import { serverAdapter } from './modules/queue-board.js';
import { emailQueue } from './queue/email.queue.js';
import { prisma } from './config/database.js';
import { redis } from './config/redis.js';
import { isEsAvailable } from './modules/search/elasticsearch.client.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './config/swagger.js';

export const app = express();

// Trust proxy for secure cookie handling behind reverse proxies
app.set('trust proxy', 1);

// Standard Middlewares
app.use(
  cors({
    origin: [env.CLIENT_BASE_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(env.COOKIE_SECRET));
app.use(requestLogger);

// Swagger / OpenAPI documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health Check Endpoint
app.get('/api/health', async (_req, res) => {
  let dbOk = false;
  let redisOk = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {}

  try {
    const ping = await redis.ping();
    redisOk = ping === 'PONG';
  } catch {}

  const esOk = isEsAvailable();

  const isHealthy = dbOk && redisOk;
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'connected' : 'disconnected',
      redis: redisOk ? 'connected' : 'disconnected',
      elasticsearch: esOk ? 'connected' : 'fallback-mode',
    },
    version: '1.0.0',
  });
});

// Protected Bull Board Queue Dashboard
if (env.ENABLE_BULL_BOARD) {
  app.use(
    env.BULL_BOARD_PATH,
    authenticate,
    requireRole(['OWNER', 'ADMIN']),
    serverAdapter.getRouter()
  );
}

// Queue Stats API
app.get('/api/queue/stats', authenticate, requireRole(['OWNER', 'ADMIN']), async (_req, res, next) => {
  try {
    const [waiting, active, delayed, completed, failed] = await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getActiveCount(),
      emailQueue.getDelayedCount(),
      emailQueue.getCompletedCount(),
      emailQueue.getFailedCount(),
    ]);

    res.json({
      queue: {
        waiting,
        active,
        delayed,
        completed,
        failed,
        total: waiting + active + delayed + completed + failed,
      },
    });
  } catch (err) {
    next(err);
  }
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/senders', sendersRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/emails', emailsRouter);
app.use('/api/slack', slackRouter);
app.use('/api/search', searchRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handler
app.use(errorHandler);
