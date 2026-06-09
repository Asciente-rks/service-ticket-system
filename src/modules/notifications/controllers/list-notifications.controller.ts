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

export const getUnreadCount = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
        const count = await notificationService.getUnreadCount(req.user.id);
        res.status(200).json({ count });
    } catch (error: any) {
        res.status(500).json({ message: 'Error counting notifications', error: error.message });
    }
};

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
        const updated = await notificationService.markAsRead(req.params.id, req.user.id);
        if (!updated) return res.status(404).json({ message: 'Notification not found' });
        res.status(200).json(updated);
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating notification', error: error.message });
    }
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
        const affected = await notificationService.markAllAsRead(req.user.id);
        res.status(200).json({ updated: affected });
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating notifications', error: error.message });
    }
};
