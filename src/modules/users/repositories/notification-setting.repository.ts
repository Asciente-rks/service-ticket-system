import { NotificationSettings, NotificationSettingsCreationAttributes } from '../models/notification-settings.model';

export const findByUserId = async (userId: string) => {
    return await NotificationSettings.findOne({ where: { userId } });
};

export const createOrUpdate = async (userId: string, data: Partial<NotificationSettingsCreationAttributes>) => {
    // TiDB Optimization: upsert uses INSERT ... ON DUPLICATE KEY UPDATE
    const [instance] = await NotificationSettings.upsert({ ...data, userId });
    return instance;
};