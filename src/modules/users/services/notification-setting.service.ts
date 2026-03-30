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
    const settings = await getNotificationSettings(userId);

    const currentData = (settings as any).get ? (settings as any).get({ plain: true }) : settings;

    const mergedUpdates = {
        ...currentData,
        ...updates
    };

    const updated = await notificationSettingRepository.createOrUpdate(userId, mergedUpdates);

    return (updated as any).get ? (updated as any).get({ plain: true }) : updated;
};
