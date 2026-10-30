import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { env } from '../../config/env.js';
import { unsign } from '../../utils/crypto.js';
import { googleAuthService } from '../../integrations/google.service.js';

const COOKIE_NAME = 'reachinbox_session';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

export class AuthController {
  /**
   * GET /api/auth/google
   * Redirects to Google OAuth authorization consent screen
   */
  startGoogleAuth(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!googleAuthService.isConfigured()) {
        res.status(400).json({
          error: 'Google OAuth is not configured on this server. Supply GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET or use /api/auth/dev-login for local development/testing.',
          code: 'OAUTH_NOT_CONFIGURED',
        });
        return;
      }
      const url = authService.getGoogleAuthUrl();
      res.redirect(url);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/google/callback
   * Handles Google OAuth callback redirect
   */
  async handleGoogleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state } = req.query;

      if (!code || typeof code !== 'string') {
        res.redirect(`${env.CLIENT_BASE_URL}/login?error=missing_code`);
        return;
      }

      if (!state || typeof state !== 'string' || !unsign(state)) {
        res.redirect(`${env.CLIENT_BASE_URL}/login?error=invalid_state`);
        return;
      }

      const session = await authService.handleGoogleCallback(code, state);
      res.cookie(COOKIE_NAME, session.token, COOKIE_OPTIONS);
      res.redirect(`${env.CLIENT_BASE_URL}/dashboard`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/dev-login
   * Allows authenticating as demo user or custom test email for testing environments
   */
  async devLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const email = req.body.email || 'demo@reachinbox.ai';
      const session = await authService.devLogin(email);
      res.cookie(COOKIE_NAME, session.token, COOKIE_OPTIONS);
      res.json({
        message: 'Authenticated successfully',
        user: session.user,
        tenant: session.tenant,
        token: session.token,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Returns current authenticated user and tenant information
   */
  async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const data = await authService.getCurrentUser(req.user.id, req.user.tenantId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Invalidates session and clears cookie
   */
  logout(req: Request, res: Response): void {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ message: 'Logged out successfully' });
  }
}

export const authController = new AuthController();
