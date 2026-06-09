import * as notificationRepository from '../repositories/notification.repository';
import { CreateNotificationDto } from '../dtos/create-notification.dto';

export const createNotification = async (data: CreateNotificationDto) => {
    return await notificationRepository.create(data);
};

export const getUserNotifications = async (userId: string) => {
    return await notificationRepository.findAllByUserId(userId);
};

export const getUnreadCount = async (userId: string) => {
    return await notificationRepository.countUnreadByUserId(userId);
};

export const markAsRead = async (notificationId: string, userId: string) => {
    return await notificationRepository.markRead(notificationId, userId);
};

export const markAllAsRead = async (userId: string) => {
    return await notificationRepository.markAllRead(userId);
};
