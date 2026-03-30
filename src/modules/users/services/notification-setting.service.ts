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
    // 1. Fetch current settings (this also handles initialization if record doesn't exist)
    const settings = await getNotificationSettings(userId);

    // If settings is a Sequelize model instance, we must extract the plain data values.
    // Spreading a model instance directly (...settings) does NOT include database column values.
    const currentData = (settings as any).get ? (settings as any).get({ plain: true }) : settings;

    // 2. Explicitly merge the updates into the current settings.
    const mergedUpdates = {
        ...currentData,
        ...updates
    };

    // 3. Perform the update with the merged data
    const updated = await notificationSettingRepository.createOrUpdate(userId, mergedUpdates);
    
    // Return as plain object to ensure immediate UI consistency
    return (updated as any).get ? (updated as any).get({ plain: true }) : updated;
};
