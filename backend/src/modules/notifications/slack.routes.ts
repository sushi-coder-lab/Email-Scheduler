import { Router } from 'express';
import { slackController } from './slack.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

export const slackRouter = Router();

// Callback doesn't require session cookie because state parameter carries tenant verification
slackRouter.get('/callback', (req, res, next) => slackController.handleCallback(req, res, next));

// Protected routes
slackRouter.use(authenticate);
slackRouter.get('/connect', (req, res, next) => slackController.startConnect(req, res, next));
slackRouter.get('/connection', (req, res, next) => slackController.getConnection(req, res, next));
slackRouter.delete('/connection', (req, res, next) => slackController.disconnect(req, res, next));
