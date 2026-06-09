import * as notificationRepository from '../repositories/notification.repository';
import { CreateNotificationDto } from '../dtos/create-notification.dto';

export const createNotification = async (data: CreateNotificationDto) => {
    return await notificationRepository.create(data);
};

/**
 * Returns the user's notifications with orphans removed. An orphan is a
 * notification whose linked ticket has since been deleted — those are filtered
 * out AND purged so they never resurface or show a dead "open ticket" click.
 */
const getValidNotifications = async (userId: string) => {
    const rows = await notificationRepository.findAllByUserIdWithTicket(userId);
    const orphanIds: string[] = [];
    const valid = rows.filter((n: any) => {
        const isOrphan = !!n.ticketId && !n.ticket;
        if (isOrphan) orphanIds.push(n.id);
        return !isOrphan;
    });
    if (orphanIds.length) {
        notificationRepository
            .deleteByIds(orphanIds)
            .catch((err) => console.error('Failed to purge orphan notifications:', err));
    }
    return valid;
};

export const getUserNotifications = async (userId: string) => {
    return await getValidNotifications(userId);
};

export const getUnreadCount = async (userId: string) => {
    const valid = await getValidNotifications(userId);
    return valid.filter((n: any) => !n.read).length;
};

export const markAsRead = async (notificationId: string, userId: string) => {
    return await notificationRepository.markRead(notificationId, userId);
};

export const markAllAsRead = async (userId: string) => {
    return await notificationRepository.markAllRead(userId);
};
