import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase, prisma } from './config/database.js';
import { initElasticsearch } from './modules/search/elasticsearch.client.js';
import { etherealSmtpService } from './integrations/ethereal.service.js';
import { runStartupReconciliation } from './workers/reconciliation.js';
import { redis } from './config/redis.js';

async function startServer() {
  logger.info('Starting ReachInbox API Server...');

  // 1. Connect PostgreSQL
  await connectDatabase();

  // 2. Initialize Elasticsearch client & index
  await initElasticsearch();

  // 3. Initialize Ethereal SMTP
  await etherealSmtpService.init();

  // 4. Run reconciliation on server start
  await runStartupReconciliation();

  // 5. Start listening
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 ReachInbox API listening on http://localhost:${env.PORT}`);
    logger.info(`📊 Bull Board Queue Monitor available at http://localhost:${env.PORT}${env.BULL_BOARD_PATH}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down API server gracefully...');
    server.close(async () => {
      try {
        await prisma.$disconnect();
        redis.disconnect();
        logger.info('API server closed cleanly');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
