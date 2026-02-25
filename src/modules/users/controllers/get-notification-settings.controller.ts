import { Response } from 'express';
import { AuthRequest } from '../../../middlewares/auth.middleware';
import * as notificationSettingService from '../services/notification-setting.service';

export const getNotificationSettings = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
        const settings = await notificationSettingService.getNotificationSettings(req.user.id);
        res.status(200).json(settings);
    } catch (error: any) {
        res.status(500).json({ message: 'Error getting notification settings', error: error.message });
    }
};