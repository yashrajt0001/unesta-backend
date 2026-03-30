import { Router } from 'express';
import { authenticateUser } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.js';
import {
  createConversation,
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  archiveConversation,
} from './messages.controller.js';
import {
  createConversationSchema,
  getConversationsSchema,
  getMessagesSchema,
  sendMessageSchema,
  conversationIdParamSchema,
  messageIdParamSchema,
} from './messages.validation.js';

const router = Router();

// All messaging routes require authentication
router.use(authenticateUser);

// Conversations
router.post('/conversations', validate(createConversationSchema), createConversation);
router.get('/conversations', validate(getConversationsSchema), getConversations);
router.get('/conversations/:id/messages', validate(getMessagesSchema), getMessages);
router.post('/conversations/:id/messages', validate(sendMessageSchema), sendMessage);
router.patch('/conversations/:id/archive', validate(conversationIdParamSchema), archiveConversation);

// Messages
router.patch('/messages/:id/read', validate(messageIdParamSchema), markAsRead);

export default router;
