import { createEmailWorker } from './email.worker.js';
import { runStartupReconciliation } from './reconciliation.js';
import { connectDatabase, prisma } from '../config/database.js';
import { etherealSmtpService } from '../integrations/ethereal.service.js';
import { initElasticsearch } from '../modules/search/elasticsearch.client.js';
import { logger } from '../config/logger.js';
import { redis } from '../config/redis.js';

async function startWorkerProcess() {
  logger.info('Initializing ReachInbox background email worker process...');

  await connectDatabase();
  await initElasticsearch();
  await etherealSmtpService.init();

  // Run startup reconciliation
  await runStartupReconciliation();

  // Start BullMQ worker
  const worker = createEmailWorker();
  logger.info('BullMQ email worker is active and awaiting jobs');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Worker shutting down gracefully...');
    try {
      await worker.close();
      await prisma.$disconnect();
      redis.disconnect();
      logger.info('Worker shutdown completed cleanly');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during worker shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startWorkerProcess().catch((err) => {
  logger.error({ err }, 'Worker process startup fatal error');
  process.exit(1);
});
