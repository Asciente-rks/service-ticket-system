import * as notificationRepository from '../repositories/notification.repository';
import { CreateNotificationDto } from '../dtos/create-notification.dto';

export const createNotification = async (data: CreateNotificationDto) => {
    return await notificationRepository.create(data);
};

export const getUserNotifications = async (userId: string) => {
    return await notificationRepository.findAllByUserId(userId);
};