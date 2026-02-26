import { NotificationSettings } from '../models/notification-settings.model';

export const getNotificationSettings = async (userId: string) => {
    let settings = await NotificationSettings.findOne({ where: { userId } });

    if (!settings) {
        settings = await NotificationSettings.create({
            userId,
            notifyAssignedTicket: true,
            notifyReportedTicket: true,
            notifyTicketApproved: true,
            notifyTicketRejected: true
        });
    }

    return settings;
};

export const updateNotificationSettings = async (userId: string, updates: Partial<NotificationSettings>) => {
    const settings = await getNotificationSettings(userId);
    await settings.update(updates);
    return settings;
};
