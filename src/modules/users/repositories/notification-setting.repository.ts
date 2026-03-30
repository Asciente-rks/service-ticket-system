import { NotificationSettings, NotificationSettingsCreationAttributes } from '../models/notification-settings.model';

export const findByUserId = async (userId: string) => {
    return await NotificationSettings.findOne({ 
        where: { userId },
        attributes: [
            'id',
            'notifyAssignedTicket', 
            'notifyReportedTicket', 
            'notifyTicketApproved', 
            'notifyTicketRejected'
        ]
    });
};

export const createOrUpdate = async (userId: string, data: Partial<NotificationSettingsCreationAttributes>) => {
    const [instance] = await NotificationSettings.upsert({ ...data, userId });
    return instance;
};