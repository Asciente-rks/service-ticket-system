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

// Purpose-aware variants keep the 'register' and 'reset' OTP flows isolated so
// a pending code for one flow can never be consumed by the other.
export const invalidateActiveByPurpose = async (email: string, purpose: string) => {
    await EmailVerification.update(
        { consumedAt: new Date() },
        { where: { email, purpose, consumedAt: null as any } },
    );
};

export const findActiveByEmailAndPurpose = async (email: string, purpose: string) => {
    return await EmailVerification.findOne({
        where: { email, purpose, consumedAt: null as any },
        order: [['createdAt', 'DESC']],
    });
};
