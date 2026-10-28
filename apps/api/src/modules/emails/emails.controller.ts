import { Request, Response, NextFunction } from 'express';
import { emailsService } from './emails.service.js';
import { parseLeads } from './lead-parser.js';
import { AppError } from '../../middleware/error.middleware.js';

export class EmailsController {
  async scheduleEmails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await emailsService.scheduleEmails(
        req.user!.tenantId,
        req.body,
        req.correlationId
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async uploadLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded. Please upload a CSV or text lead file.', 400, 'FILE_MISSING');
      }

      const content = req.file.buffer.toString('utf8');
      const filename = req.file.originalname || 'leads.csv';

      const parseResult = parseLeads(content, filename);

      res.json({
        filename,
        totalDetected: parseResult.totalDetected,
        validCount: parseResult.validCount,
        invalidCount: parseResult.invalidCount,
        duplicateCount: parseResult.duplicateCount,
        validEmails: parseResult.validEmails,
        preview: parseResult.preview,
      });
    } catch (error) {
      next(error);
    }
  }

  async listScheduled(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await emailsService.listScheduledEmails(req.user!.tenantId, req.query as never);
      res.json(data);
    } catch (error) {
      next(error);
    }
  }

  async listSent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await emailsService.listSentEmails(req.user!.tenantId, req.query as never);
      res.json(data);
    } catch (error) {
      next(error);
    }
  }

  async getEmailById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const email = await emailsService.getEmailById(req.user!.tenantId, req.params.id);
      res.json({ email });
    } catch (error) {
      next(error);
    }
  }

  async cancelEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cancelled = await emailsService.cancelEmail(req.user!.tenantId, req.params.id);
      res.json({ message: 'Email job cancelled successfully', email: cancelled });
    } catch (error) {
      next(error);
    }
  }

  async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await emailsService.getDashboardMetrics(req.user!.tenantId);
      res.json(metrics);
    } catch (error) {
      next(error);
    }
  }
}

export const emailsController = new EmailsController();
