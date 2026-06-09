import { EmailVerification } from '../models/email-verification.model';

export const invalidateActive = async (email: string) => {
    await EmailVerification.update(
        { consumedAt: new Date() },
        { where: { email, consumedAt: null as any } },
    );
};

export const create = async (data: {
    email: string;
    codeHash: string;
    expiresAt: Date;
    purpose?: string;
}) => {
    return await EmailVerification.create(data);
};

export const findActiveByEmail = async (email: string) => {
    return await EmailVerification.findOne({
        where: { email, consumedAt: null as any },
        order: [['createdAt', 'DESC']],
    });
};
