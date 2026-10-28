import { Request, Response, NextFunction } from 'express';
import { campaignsService } from './campaigns.service.js';

export class CampaignsController {
  async listCampaigns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaigns = await campaignsService.listCampaigns(req.user!.tenantId);
      res.json({ campaigns });
    } catch (error) {
      next(error);
    }
  }

  async getCampaignById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaign = await campaignsService.getCampaignById(req.user!.tenantId, req.params.id);
      res.json({ campaign });
    } catch (error) {
      next(error);
    }
  }

  async createCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaign = await campaignsService.createCampaign(req.user!.tenantId, req.body);
      res.status(201).json({ campaign });
    } catch (error) {
      next(error);
    }
  }
}

export const campaignsController = new CampaignsController();
