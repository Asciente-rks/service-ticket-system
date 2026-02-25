import { Router } from 'express';
import { listNotifications } from '../controllers/list-notifications.controller';
import { authenticateToken } from '../../../middlewares/auth.middleware';

export const notificationRouter = Router();

notificationRouter.get('/', authenticateToken, listNotifications);