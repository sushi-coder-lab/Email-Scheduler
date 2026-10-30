import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

export const authRouter = Router();

authRouter.get('/google', (req, res, next) => authController.startGoogleAuth(req, res, next));
authRouter.get('/google/callback', (req, res, next) => authController.handleGoogleCallback(req, res, next));
authRouter.post('/dev-login', (req, res, next) => authController.devLogin(req, res, next));
authRouter.get('/me', authenticate, (req, res, next) => authController.getCurrentUser(req, res, next));
authRouter.post('/logout', authenticate, (req, res) => authController.logout(req, res));
