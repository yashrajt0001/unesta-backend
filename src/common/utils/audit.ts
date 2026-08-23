import type { Request } from 'express';
import { AuditTargetType } from '@prisma/client';
import { prisma } from '../config/database.js';
import { logger } from './logger.js';

/**
 * Writes one line of the moderator audit trail.
 *
 * Called from admin controllers rather than services: the controller is where
 * `req.admin` lives, and threading the moderator through every service signature
 * just to log would be noise.
 *
 * Best effort by design — a failed log must never fail the action it describes,
 * otherwise a broken audit table would take moderation down with it.
 */
export const recordAudit = (
  req: Request,
  action: string,
  targetType: AuditTargetType,
  targetId: string,
  summary: string,
): void => {
  const admin = req.admin;
  if (!admin) return;

  void prisma.auditLog
    .create({
      data: {
        moderatorId: admin.adminId,
        moderatorEmail: admin.email,
        action,
        targetType,
        targetId,
        summary,
      },
    })
    .catch((error) => {
      logger.error({ err: error, action, targetType, targetId }, 'Failed to write audit log');
    });
};
