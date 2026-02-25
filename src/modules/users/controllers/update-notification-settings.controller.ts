import { Response } from 'express';
import { AuthRequest } from '../../../middlewares/auth.middleware';
import * as notificationSettingService from '../services/notification-setting.service';
import { UpdateNotificationSettingsDto } from '../dtos/update-notification-settings.dto';

export const updateNotificationSettings = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
        const settings = await notificationSettingService.updateNotificationSettings(req.user.id, req.body as UpdateNotificationSettingsDto);
        res.status(200).json(settings);
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating notification settings', error: error.message });
    }
};