import * as notificationSettingRepository from '../repositories/notification-setting.repository';
import { UpdateNotificationSettingsDto } from '../dtos/update-notification-settings.dto';
import { NotificationSettingResponseDto } from '../dtos/notification-setting-response.dto';

export const getNotificationSettings = async (userId: string): Promise<NotificationSettingResponseDto> => {
    const settings = await notificationSettingRepository.findByUserId(userId);
    
    if (!settings) {
        return {
            notifyAssignedTicket: true,
            notifyReportedTicket: true,
            notifyTicketApproved: true,
            notifyTicketRejected: true
        };
    }
    
    return settings;
};

export const updateNotificationSettings = async (userId: string, settingsData: UpdateNotificationSettingsDto): Promise<NotificationSettingResponseDto> => {
    const updatedSettings = await notificationSettingRepository.createOrUpdate(userId, settingsData);
    return updatedSettings;
};