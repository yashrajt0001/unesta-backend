import { z } from 'zod';

export const createConversationSchema = z.object({
  body: z.object({
    listingId: z.string().uuid(),
    hostId: z.string().uuid(),
    bookingId: z.string().uuid().optional(),
    message: z.string().min(1).max(1000),
  }),
});

export const conversationIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid conversation ID'),
  }),
});

export const sendMessageSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid conversation ID'),
  }),
  body: z.object({
    content: z.string().min(1).max(1000),
  }),
});

export const getConversationsSchema = z.object({
  query: z.object({
    role: z.enum(['guest', 'host']).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(20),
  }),
});

export const getMessagesSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid conversation ID'),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(30),
  }),
});

export const messageIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid message ID'),
  }),
});
