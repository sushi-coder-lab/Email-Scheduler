import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../middleware/error.middleware.js';

export class GoogleAuthService {
  private client: OAuth2Client | null = null;

  constructor() {
    if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
      this.client = new OAuth2Client(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        env.GOOGLE_CALLBACK_URL
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.client && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  }

  getAuthUrl(state: string): string {
    if (!this.client) {
      throw new AppError(
        'Google OAuth is not configured. Please supply GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env',
        500,
        'OAUTH_NOT_CONFIGURED'
      );
    }

    return this.client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state,
    });
  }

  async verifyAndGetUser(code: string): Promise<{
    googleId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }> {
    if (!this.client) {
      throw new AppError('Google OAuth is not configured', 500, 'OAUTH_NOT_CONFIGURED');
    }

    try {
      const { tokens } = await this.client.getToken(code);
      this.client.setCredentials(tokens);

      if (!tokens.id_token) {
        throw new AppError('No ID token returned by Google', 400, 'OAUTH_ID_TOKEN_MISSING');
      }

      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token,
        audience: env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        throw new AppError('Invalid Google token payload', 400, 'OAUTH_INVALID_PAYLOAD');
      }

      return {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        avatarUrl: payload.picture,
      };
    } catch (error) {
      logger.error({ err: error }, 'Google OAuth code exchange failed');
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to authenticate with Google', 400, 'OAUTH_EXCHANGE_FAILED');
    }
  }
}

export const googleAuthService = new GoogleAuthService();
