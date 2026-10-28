import { Request, Response, NextFunction } from 'express';
import { searchService } from './search.service.js';

export class SearchController {
  async searchEmails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, status, senderId, campaignId, page, limit } = req.query;

      const results = await searchService.search({
        tenantId: req.user!.tenantId,
        query: typeof q === 'string' ? q : undefined,
        status: typeof status === 'string' ? status : undefined,
        senderId: typeof senderId === 'string' ? senderId : undefined,
        campaignId: typeof campaignId === 'string' ? campaignId : undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      res.json(results);
    } catch (error) {
      next(error);
    }
  }

  async reindex(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await searchService.reindexAll(req.user!.tenantId);
      res.json({ message: 'Search index rebuilt successfully', ...result });
    } catch (error) {
      next(error);
    }
  }
}

export const searchController = new SearchController();
