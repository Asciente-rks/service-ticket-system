import { Organization } from '../models/organization.model';
import { User } from '../../users/models/user.model';

export const create = async (data: {
    name: string;
    slug: string;
    inviteCode: string;
    ownerId: string;
}) => {
    return await Organization.create(data);
};

export const findById = async (id: string) => {
    return await Organization.findByPk(id);
};

export const findByInviteCode = async (inviteCode: string) => {
    return await Organization.findOne({ where: { inviteCode } });
};

export const findBySlug = async (slug: string) => {
    return await Organization.findOne({ where: { slug } });
};

export const countMembers = async (organizationId: string) => {
    return await User.count({ where: { organizationId } });
};

export const update = async (id: string, updates: Partial<{ name: string; ownerId: string }>) => {
    const org = await Organization.findByPk(id);
    if (!org) return null;
    return await org.update(updates);
};
