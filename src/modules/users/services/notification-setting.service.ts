import { NotificationSettings } from '../models/notification-settings.model';
import * as notificationSettingRepository from '../repositories/notification-setting.repository';

export const getNotificationSettings = async (userId: string) => {
    let settings = await notificationSettingRepository.findByUserId(userId);

    if (!settings) {
        settings = await notificationSettingRepository.createOrUpdate(userId, {
            notifyAssignedTicket: true,
            notifyReportedTicket: true,
            notifyTicketApproved: true,
            notifyTicketRejected: true
        });
    }

    return settings;
};

export const updateNotificationSettings = async (userId: string, updates: Partial<NotificationSettings>) => {
    return await notificationSettingRepository.createOrUpdate(userId, updates);
};
