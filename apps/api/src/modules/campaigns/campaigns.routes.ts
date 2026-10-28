import { Router } from 'express';
import { campaignsController } from './campaigns.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createCampaignSchema } from './campaigns.schema.js';

export const campaignsRouter = Router();

campaignsRouter.use(authenticate);

campaignsRouter.get('/', (req, res, next) => campaignsController.listCampaigns(req, res, next));
campaignsRouter.get('/:id', (req, res, next) => campaignsController.getCampaignById(req, res, next));
campaignsRouter.post('/', validate({ body: createCampaignSchema }), (req, res, next) =>
  campaignsController.createCampaign(req, res, next)
);
