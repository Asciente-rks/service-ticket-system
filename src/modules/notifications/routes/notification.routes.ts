import { Router } from 'express';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/list-notifications.controller';
import { authenticateToken, requireOrganization } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validator.middleware';
import {
  listNotificationsSchema,
  notificationIdParamsSchema,
} from '../../../utils/notification.validation';

export const notificationRouter = Router();

notificationRouter.use(authenticateToken, requireOrganization);

notificationRouter.get('/', validate(listNotificationsSchema), listNotifications);
notificationRouter.get('/unread-count', getUnreadCount);
notificationRouter.patch('/read-all', markAllNotificationsRead);
notificationRouter.patch('/:id/read', validate(notificationIdParamsSchema), markNotificationRead);
