import { Request, Response, NextFunction } from 'express';
import { sendersService } from './senders.service.js';

export class SendersController {
  async listSenders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const senders = await sendersService.listSenders(req.user!.tenantId);
      res.json({ senders });
    } catch (error) {
      next(error);
    }
  }

  async createSender(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sender = await sendersService.createSender(req.user!.tenantId, req.body);
      res.status(201).json({ sender });
    } catch (error) {
      next(error);
    }
  }
}

export const sendersController = new SendersController();
