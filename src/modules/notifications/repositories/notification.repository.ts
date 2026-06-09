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

export const countUnreadByUserId = async (userId: string) => {
    return await Notification.count({ where: { userId, read: false } });
};

export const markRead = async (id: string, userId: string) => {
    const notification = await Notification.findOne({ where: { id, userId } });
    if (!notification) return null;
    if (!notification.read) {
        notification.read = true;
        await notification.save();
    }
    return notification;
};

export const markAllRead = async (userId: string) => {
    const [affected] = await Notification.update(
        { read: true },
        { where: { userId, read: false } },
    );
    return affected;
};
