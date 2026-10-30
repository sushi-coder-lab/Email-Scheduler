import { esClient, isEsAvailable } from './elasticsearch.client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { Prisma } from '@prisma/client';

export interface EmailSearchQuery {
  tenantId: string;
  query?: string;
  status?: string;
  senderId?: string;
  campaignId?: string;
  page?: number;
  limit?: number;
}

export interface SearchResultItem {
  id: string;
  recipientEmail: string;
  subject: string;
  status: string;
  senderId: string;
  senderEmail?: string;
  scheduledTime: string;
  sentAt?: string | null;
  createdAt: string;
  campaignId?: string | null;
}

export interface SearchResult {
  items: SearchResultItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  source: 'elasticsearch' | 'database';
}

export class SearchService {
  /**
   * Indexes a single email job into Elasticsearch
   */
  async indexEmail(emailJob: {
    id: string;
    tenantId: string;
    recipientEmail: string;
    subject: string;
    status: string;
    senderId: string;
    sender?: { senderEmail: string };
    campaignId?: string | null;
    scheduledTime: Date;
    sentAt?: Date | null;
    createdAt: Date;
  }): Promise<void> {
    if (!isEsAvailable()) return;

    try {
      await esClient.index({
        index: env.ELASTICSEARCH_INDEX,
        id: emailJob.id,
        document: {
          id: emailJob.id,
          tenantId: emailJob.tenantId,
          recipientEmail: emailJob.recipientEmail,
          subject: emailJob.subject,
          status: emailJob.status,
          senderId: emailJob.senderId,
          senderEmail: emailJob.sender?.senderEmail,
          campaignId: emailJob.campaignId,
          scheduledTime: emailJob.scheduledTime.toISOString(),
          sentAt: emailJob.sentAt ? emailJob.sentAt.toISOString() : null,
          createdAt: emailJob.createdAt.toISOString(),
        },
      });
    } catch (error) {
      logger.warn({ err: (error as Error).message, emailId: emailJob.id }, 'Failed to index email in Elasticsearch (queued via outbox)');
    }
  }

  /**
   * Bulk indexes an array of email jobs
   */
  async bulkIndex(emails: Array<{
    id: string;
    tenantId: string;
    recipientEmail: string;
    subject: string;
    status: string;
    senderId: string;
    sender?: { senderEmail: string };
    campaignId?: string | null;
    scheduledTime: Date;
    sentAt?: Date | null;
    createdAt: Date;
  }>): Promise<void> {
    if (!isEsAvailable() || emails.length === 0) return;

    const operations = emails.flatMap((doc) => [
      { index: { _index: env.ELASTICSEARCH_INDEX, _id: doc.id } },
      {
        id: doc.id,
        tenantId: doc.tenantId,
        recipientEmail: doc.recipientEmail,
        subject: doc.subject,
        status: doc.status,
        senderId: doc.senderId,
        senderEmail: doc.sender?.senderEmail,
        campaignId: doc.campaignId,
        scheduledTime: doc.scheduledTime.toISOString(),
        sentAt: doc.sentAt ? doc.sentAt.toISOString() : null,
        createdAt: doc.createdAt.toISOString(),
      },
    ]);

    try {
      await esClient.bulk({ refresh: true, operations });
    } catch (error) {
      logger.error({ err: error }, 'Elasticsearch bulk index failed');
    }
  }

  /**
   * Searches email records with tenant isolation
   */
  async search(params: EmailSearchQuery): Promise<SearchResult> {
    const { tenantId, query, status, senderId, campaignId } = params;
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const from = (page - 1) * limit;

    // 1. Attempt Elasticsearch search if available
    if (isEsAvailable()) {
      try {
        const mustClauses: unknown[] = [];
        const filterClauses: unknown[] = [{ term: { tenantId } }];

        if (status) {
          filterClauses.push({ term: { status } });
        }
        if (senderId) {
          filterClauses.push({ term: { senderId } });
        }
        if (campaignId) {
          filterClauses.push({ term: { campaignId } });
        }

        if (query && query.trim()) {
          mustClauses.push({
            multi_match: {
              query: query.trim(),
              fields: ['recipientEmail^3', 'subject^2', 'recipientEmail.keyword'],
              fuzziness: 'AUTO',
            },
          });
        } else {
          mustClauses.push({ match_all: {} });
        }

        const response = await esClient.search({
          index: env.ELASTICSEARCH_INDEX,
          from,
          size: limit,
          sort: [{ createdAt: { order: 'desc' } }],
          query: {
            bool: {
              must: mustClauses as never,
              filter: filterClauses as never,
            },
          },
        });

        const total = typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value || 0;
        const items = response.hits.hits.map((hit) => hit._source as SearchResultItem);

        return {
          items,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          source: 'elasticsearch',
        };
      } catch (error) {
        logger.warn({ err: (error as Error).message }, 'Elasticsearch query failed, falling back to database query');
      }
    }

    // 2. Database search fallback
    const where: Prisma.EmailJobWhereInput = {
      tenantId,
      ...(status ? { status } : {}),
      ...(senderId ? { senderId } : {}),
      ...(campaignId ? { campaignId } : {}),
    };

    if (query && query.trim()) {
      const q = query.trim();
      where.OR = [
        { recipientEmail: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        skip: from,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { sender: { select: { senderEmail: true } } },
      }),
    ]);

    const items: SearchResultItem[] = records.map((r) => ({
      id: r.id,
      recipientEmail: r.recipientEmail,
      subject: r.subject,
      status: r.status,
      senderId: r.senderId,
      senderEmail: r.sender?.senderEmail,
      campaignId: r.campaignId,
      scheduledTime: r.scheduledTime.toISOString(),
      sentAt: r.sentAt ? r.sentAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      source: 'database',
    };
  }

  /**
   * Rebuilds the search index for a tenant from PostgreSQL
   */
  async reindexAll(tenantId?: string): Promise<{ indexedCount: number }> {
    const where: Prisma.EmailJobWhereInput = tenantId ? { tenantId } : {};
    const emails = await prisma.emailJob.findMany({
      where,
      include: { sender: { select: { senderEmail: true } } },
      take: 10000,
    });

    await this.bulkIndex(emails);
    logger.info({ count: emails.length, tenantId }, 'Reindexed emails into search index');
    return { indexedCount: emails.length };
  }
}

export const searchService = new SearchService();
