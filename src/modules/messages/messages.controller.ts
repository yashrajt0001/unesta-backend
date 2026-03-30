import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/types/index.js';
import {
  createConversationService,
  getConversationsService,
  getMessagesService,
  sendMessageService,
  markAsReadService,
  archiveConversationService,
} from './messages.service.js';

export const createConversation = asyncHandler(async (req: Request, res: Response) => {
  const conversation = await createConversationService(req.user!.userId, req.body);
  res.status(201).json({ success: true, message: 'Conversation started', data: conversation });
});

export const getConversations = asyncHandler(async (req: Request, res: Response) => {
  const role = req.query['role'] as 'guest' | 'host' | undefined;
  const page = Number(req.query['page']);
  const limit = Number(req.query['limit']);
  const result = await getConversationsService(req.user!.userId, role, page, limit);
  res.status(200).json({ success: true, message: 'Conversations retrieved', data: result.conversations, pagination: result.pagination });
});

export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query['page']);
  const limit = Number(req.query['limit']);
  const result = await getMessagesService(req.params['id'] as string, req.user!.userId, page, limit);
  res.status(200).json({ success: true, message: 'Messages retrieved', data: result.messages, pagination: result.pagination });
});

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const message = await sendMessageService(req.params['id'] as string, req.user!.userId, req.body.content);
  res.status(201).json({ success: true, message: 'Message sent', data: message });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const result = await markAsReadService(req.params['id'] as string, req.user!.userId);
  res.status(200).json({ success: true, message: 'Message marked as read', data: result });
});

export const archiveConversation = asyncHandler(async (req: Request, res: Response) => {
  const result = await archiveConversationService(req.params['id'] as string, req.user!.userId);
  res.status(200).json({ success: true, message: 'Conversation archived', data: result });
});
