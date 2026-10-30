import { Client } from '@elastic/elasticsearch';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
  requestTimeout: 3000,
  maxRetries: 2,
});

let esAvailable = false;

export async function initElasticsearch(): Promise<boolean> {
  try {
    const health = await esClient.cluster.health({});
    esAvailable = true;
    logger.info({ status: health.status }, 'Elasticsearch cluster is connected and healthy');

    // Create index if it does not exist
    const exists = await esClient.indices.exists({ index: env.ELASTICSEARCH_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: env.ELASTICSEARCH_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            tenantId: { type: 'keyword' },
            recipientEmail: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            subject: { type: 'text' },
            status: { type: 'keyword' },
            senderId: { type: 'keyword' },
            senderEmail: { type: 'keyword' },
            campaignId: { type: 'keyword' },
            scheduledTime: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' },
          },
        },
      });
      logger.info({ index: env.ELASTICSEARCH_INDEX }, 'Created Elasticsearch email search index');
    }

    return true;
  } catch (error) {
    esAvailable = false;
    logger.warn({ err: (error as Error).message }, 'Elasticsearch unavailable (falling back to database search engine)');
    return false;
  }
}

export function isEsAvailable(): boolean {
  return esAvailable;
}
