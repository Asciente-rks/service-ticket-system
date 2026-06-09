import { Notification } from '../models/notification.model';
import { Ticket } from '../../tickets/models/ticket.model';
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

// Includes the linked ticket (if any) so the service can drop orphaned
// notifications whose ticket has been deleted.
export const findAllByUserIdWithTicket = async (userId: string) => {
    return await Notification.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        include: [{ model: Ticket, as: 'ticket', attributes: ['id'], required: false }],
    });
};

export const deleteByIds = async (ids: string[]) => {
    if (!ids.length) return 0;
    return await Notification.destroy({ where: { id: ids } });
};

export const deleteByTicketId = async (ticketId: string) => {
    return await Notification.destroy({ where: { ticketId } });
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
