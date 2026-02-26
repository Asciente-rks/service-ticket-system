import { getNotificationSettings } from '../controllers/get-notification-settings.controller';
import { updateNotificationSettings } from '../controllers/update-notification-settings.controller';
import { updateNotificationSettingsSchema } from '../../../utils/notification.validation';
import { Router } from 'express';
import { validate } from '../../../middlewares/validator.middleware';

export const notificationSettingsRouter = Router();

notificationSettingsRouter.get('/', getNotificationSettings);
notificationSettingsRouter.patch('/', validate(updateNotificationSettingsSchema), updateNotificationSettings);