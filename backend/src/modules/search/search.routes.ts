import { Router } from 'express';
import { searchController } from './search.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

export const searchRouter = Router();

searchRouter.use(authenticate);

searchRouter.get('/emails', (req, res, next) => searchController.searchEmails(req, res, next));
searchRouter.post('/reindex', (req, res, next) => searchController.reindex(req, res, next));
