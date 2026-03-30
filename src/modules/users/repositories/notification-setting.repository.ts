import { NotificationSettings, NotificationSettingsCreationAttributes } from '../models/notification-settings.model';

export const findByUserId = async (userId: string) => {
    return await NotificationSettings.findOne({ 
        where: { userId },
        attributes: [
            'id', // Fetching the primary key ensures the 'upsert' can identify the existing record
            'notifyAssignedTicket', 
            'notifyReportedTicket', 
            'notifyTicketApproved', 
            'notifyTicketRejected'
        ]
    });
};

export const createOrUpdate = async (userId: string, data: Partial<NotificationSettingsCreationAttributes>) => {
    // TiDB Optimization: upsert uses INSERT ... ON DUPLICATE KEY UPDATE
    const [instance] = await NotificationSettings.upsert({ ...data, userId });
    return instance;
};