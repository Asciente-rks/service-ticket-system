import { Response } from 'express';
import { AuthRequest } from '../../../middlewares/auth.middleware';
import * as notificationService from '../services/notification.service';

export const listNotifications = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
        const notifications = await notificationService.getUserNotifications(req.user.id);
        res.status(200).json(notifications);
    } catch (error: any) {
        res.status(500).json({ message: 'Error listing notifications', error: error.message });
    }
};