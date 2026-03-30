import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, verifyAdminAccessToken } from '../utils/jwt.js';
import { prisma } from '../config/database.js';
import { AppError } from './error-handler.js';

export const authenticateUser = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Access token required', 401);
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    if (payload.type !== 'access') {
      throw new AppError('Invalid token type', 401);
    }

    req.user = { userId: payload.userId };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Invalid or expired access token', 401));
    }
  }
};

export const optionalAuthenticateUser = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    if (payload.type === 'access') {
      req.user = { userId: payload.userId };
    }
  } catch {
    // Token invalid — continue without user context
  }
  next();
};

export const authenticateAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Access token required', 401);
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAdminAccessToken(token);

    if (payload.type !== 'admin_access') {
      throw new AppError('Invalid token type', 401);
    }

    // Fetch admin with roles and permissions
    const moderator = await prisma.moderator.findUnique({
      where: { id: payload.adminId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!moderator) {
      throw new AppError('Admin not found', 401);
    }

    const permissions = moderator.roles.flatMap((mr) =>
      mr.role.permissions.map((rp) => rp.permission.name),
    );

    req.admin = {
      adminId: moderator.id,
      email: moderator.email,
      permissions: [...new Set(permissions)],
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Invalid or expired admin token', 401));
    }
  }
};
