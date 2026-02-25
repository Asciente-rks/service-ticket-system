import { Notification } from '../models/notification.model';
import { CreateNotificationDto } from '../dtos/create-notification.dto';

export const create = async (data: CreateNotificationDto) => {
    return await Notification.create(data);
};

export const findAllByUserId = async (userId: string) => {
    return await Notification.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']]
    });
};