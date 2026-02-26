import { Router } from 'express';
import { listNotifications } from '../controllers/list-notifications.controller';
import { authenticateToken } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validator.middleware';
import { listNotificationsSchema } from '../../../utils/notification.validation';

export const notificationRouter = Router();

notificationRouter.get('/', authenticateToken, validate(listNotificationsSchema), listNotifications);