import type { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler.js';

/**
 * The permission names seeded in `prisma/seed.ts`. Keeping them as a union means
 * a typo in a route guard is a compile error rather than a route nobody can call.
 */
export type PermissionName =
  | 'users_management'
  | 'properties_management'
  | 'bookings_management'
  | 'reviews_management'
  | 'financials_management'
  | 'reports_management'
  | 'moderators_management';

/**
 * Route guard for admin endpoints. `authenticateAdmin` must run first — it is
 * what puts the moderator's resolved permissions on the request.
 *
 * Without this the permission system is cosmetic: the console hides sections a
 * moderator cannot use, but the endpoints behind them stay open to anyone
 * holding a valid admin token.
 */
export const requirePermission =
  (permission: PermissionName) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.admin) {
      next(new AppError('Admin authentication required', 401));
      return;
    }

    if (!req.admin.permissions.includes(permission)) {
      next(new AppError(`You do not have the ${permission} permission`, 403));
      return;
    }

    next();
  };

/** True when the moderator holds the permission. For filtering, not guarding. */
export const hasPermission = (req: Request, permission: PermissionName): boolean =>
  req.admin?.permissions.includes(permission) ?? false;
