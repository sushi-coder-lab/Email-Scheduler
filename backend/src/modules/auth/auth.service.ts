import { prisma } from '../../config/database.js';
import { sign } from '../../utils/crypto.js';
import { googleAuthService } from '../../integrations/google.service.js';
import { AppError } from '../../middleware/error.middleware.js';
import { logger } from '../../config/logger.js';

export interface UserSession {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
  tenant: {
    id: string;
    name: string;
    role: string;
  };
  token: string;
}

export class AuthService {
  /**
   * Generates Google OAuth redirect URL with signed state
   */
  getGoogleAuthUrl(): string {
    const nonce = Math.random().toString(36).substring(2);
    const state = sign(JSON.stringify({ nonce, timestamp: Date.now() }));
    return googleAuthService.getAuthUrl(state);
  }

  /**
   * Completes Google OAuth callback and returns user session
   */
  async handleGoogleCallback(code: string, state: string): Promise<UserSession> {
    const googleProfile = await googleAuthService.verifyAndGetUser(code);
    return this.findOrCreateUserAndSession(googleProfile);
  }

  /**
   * Creates or retrieves user, ensures default tenant and returns signed session
   */
  async findOrCreateUserAndSession(profile: {
    googleId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }): Promise<UserSession> {
    const normalizedEmail = profile.email.toLowerCase().trim();

    // Upsert User
    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        googleId: profile.googleId,
      },
      create: {
        googleId: profile.googleId,
        email: normalizedEmail,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      },
    });

    // Check existing membership
    let membership = await prisma.tenantMembership.findFirst({
      where: { userId: user.id },
      include: { tenant: true },
    });

    // If new user, create default tenant workspace
    if (!membership) {
      const workspaceName = `${profile.name.split(' ')[0]}'s Workspace`;
      const tenant = await prisma.tenant.create({
        data: {
          name: workspaceName,
        },
      });

      membership = await prisma.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: 'OWNER',
        },
        include: { tenant: true },
      });

      // Also create default sender
      await prisma.emailSender.create({
        data: {
          tenantId: tenant.id,
          senderEmail: user.email,
          displayName: user.name,
          isActive: true,
        },
      });

      logger.info({ userId: user.id, tenantId: tenant.id }, 'Created initial tenant and sender');
    }

    const token = sign(`${user.id}:${membership.tenantId}:${Date.now()}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      tenant: {
        id: membership.tenant.id,
        name: membership.tenant.name,
        role: membership.role,
      },
      token,
    };
  }

  /**
   * Local development login for evaluation when Google OAuth credentials are not provided
   */
  async devLogin(email = 'demo@reachinbox.ai'): Promise<UserSession> {
    return this.findOrCreateUserAndSession({
      googleId: `dev-google-${email}`,
      email,
      name: email === 'demo@reachinbox.ai' ? 'ReachInbox Demo Operator' : email.split('@')[0],
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    });
  }

  /**
   * Retrieves current authenticated user with tenant context
   */
  async getCurrentUser(userId: string, tenantId: string) {
    const membership = await prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId,
        },
      },
      include: {
        user: true,
        tenant: true,
      },
    });

    if (!membership) {
      throw new AppError('User membership not found', 404, 'NOT_FOUND');
    }

    return {
      user: {
        id: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
        avatarUrl: membership.user.avatarUrl,
        createdAt: membership.user.createdAt,
      },
      tenant: {
        id: membership.tenant.id,
        name: membership.tenant.name,
        role: membership.role,
      },
    };
  }
}

export const authService = new AuthService();
