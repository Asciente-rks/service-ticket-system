import { NotificationSettings, NotificationSettingsCreationAttributes } from '../models/notification-settings.model';

export const findByUserId = async (userId: string) => {
    return await NotificationSettings.findOne({ where: { userId } });
};

export const createOrUpdate = async (userId: string, data: Partial<NotificationSettingsCreationAttributes>) => {
    const [settings, created] = await NotificationSettings.findOrCreate({
        where: { userId },
        defaults: { ...data, userId } as NotificationSettingsCreationAttributes
    });

    if (!created) {
        return await settings.update(data);
    }
    return settings;
};