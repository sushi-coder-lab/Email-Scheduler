import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { unsign } from '../utils/crypto.js';
import { AppError } from './error.middleware.js';

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let sessionToken = req.cookies?.reachinbox_session;

    // Also support Authorization header for API testing
    const authHeader = req.headers.authorization;
    if (!sessionToken && authHeader && authHeader.startsWith('Bearer ')) {
      sessionToken = authHeader.slice(7);
    }

    if (!sessionToken) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const payload = unsign(sessionToken);
    if (!payload) {
      throw new AppError('Invalid or expired session', 401, 'INVALID_SESSION');
    }

    const [userId, tenantId] = payload.split(':');
    if (!userId || !tenantId) {
      throw new AppError('Malformed session token', 401, 'MALFORMED_SESSION');
    }

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
      throw new AppError('Unauthorized: User is not a member of this tenant', 403, 'FORBIDDEN');
    }

    req.user = {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      avatarUrl: membership.user.avatarUrl,
      tenantId: membership.tenantId,
      role: membership.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }
    next();
  };
}
