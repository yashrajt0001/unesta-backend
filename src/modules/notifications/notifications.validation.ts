import { z } from 'zod';

export const listNotificationsSchema = z.object({
  query: z.object({
    unreadOnly: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(20),
  }),
});

export const notificationIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid notification ID'),
  }),
});
