import { Router } from 'express';
import { authenticateUser } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.js';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from './notifications.controller.js';
import {
  listNotificationsSchema,
  notificationIdParamSchema,
} from './notifications.validation.js';

const router = Router();

router.use(authenticateUser);

router.get('/', validate(listNotificationsSchema), listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', validate(notificationIdParamSchema), markAsRead);

export default router;
