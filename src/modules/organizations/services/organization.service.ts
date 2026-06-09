import * as organizationRepository from '../repositories/organization.repository';
import * as userRepository from '../../users/repositories/user.repository';
import * as notificationSettingService from '../../users/services/notification-setting.service';
import { signUserToken } from '../../../utils/token';
import { ROLES } from '../../../config/roles';

const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars

const slugify = (name: string): string =>
    name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 40) || 'org';

const randomCode = (length: number): string => {
    let out = '';
    for (let i = 0; i < length; i += 1) {
        out += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
    }
    return out;
};

const generateUniqueSlug = async (name: string): Promise<string> => {
    const base = slugify(name);
    let slug = base;
    let i = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await organizationRepository.findBySlug(slug)) {
        slug = `${base}-${i}`;
        i += 1;
    }
    return slug;
};

const generateUniqueInviteCode = async (): Promise<string> => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const code = `ORG-${randomCode(6)}`;
        // eslint-disable-next-line no-await-in-loop
        if (!(await organizationRepository.findByInviteCode(code))) return code;
    }
};

const toOrganizationDto = (org: any, memberCount: number, includeInvite: boolean) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    memberCount,
    isOwner: false,
    ...(includeInvite ? { inviteCode: org.inviteCode } : {}),
    createdAt: org.createdAt,
});

const toUserDto = (user: any) => ({
    id: user.id.toString(),
    roleId: user.roleId ?? null,
    organizationId: user.organizationId ?? null,
    name: user.name,
    email: user.email,
});

export const createOrganization = async (userId: string, name: string) => {
    const user = await userRepository.findBasicById(userId);
    if (!user) throw new Error('User not found');

    if (user.organizationId) {
        const err: any = new Error('You already belong to an organization.');
        err.statusCode = 409;
        throw err;
    }

    const slug = await generateUniqueSlug(name);
    const inviteCode = await generateUniqueInviteCode();

    const org = await organizationRepository.create({
        name: name.trim(),
        slug,
        inviteCode,
        ownerId: userId,
    });

    // Org creator becomes SuperAdmin of their own tenant.
    await userRepository.update(userId, {
        organizationId: org.id,
        roleId: ROLES.SUPER_ADMIN,
    });

    await notificationSettingService.getNotificationSettings(userId);

    const token = signUserToken({
        id: userId,
        roleId: ROLES.SUPER_ADMIN,
        organizationId: org.id,
        email: user.email,
        role: 'SuperAdmin',
    });

    const refreshed = await userRepository.findBasicById(userId);
    const dto = toOrganizationDto(org, 1, true);
    dto.isOwner = true;

    return { organization: dto, token, user: toUserDto(refreshed) };
};

export const joinOrganization = async (userId: string, inviteCode: string) => {
    const user = await userRepository.findBasicById(userId);
    if (!user) throw new Error('User not found');

    if (user.organizationId) {
        const err: any = new Error('You already belong to an organization.');
        err.statusCode = 409;
        throw err;
    }

    const org = await organizationRepository.findByInviteCode(inviteCode.trim());
    if (!org) {
        const err: any = new Error('Invalid invite code.');
        err.statusCode = 404;
        throw err;
    }

    // New members join as Tester (can report tickets immediately); an org admin
    // can promote them in User Management.
    await userRepository.update(userId, {
        organizationId: org.id,
        roleId: ROLES.TESTER,
    });

    await notificationSettingService.getNotificationSettings(userId);

    const token = signUserToken({
        id: userId,
        roleId: ROLES.TESTER,
        organizationId: org.id,
        email: user.email,
        role: 'Tester',
    });

    const memberCount = await organizationRepository.countMembers(org.id);
    const refreshed = await userRepository.findBasicById(userId);

    return {
        organization: toOrganizationDto(org, memberCount, false),
        token,
        user: toUserDto(refreshed),
    };
};

export const getMyOrganization = async (organizationId: string, isAdmin: boolean) => {
    const org = await organizationRepository.findById(organizationId);
    if (!org) return null;
    const memberCount = await organizationRepository.countMembers(organizationId);
    const dto = toOrganizationDto(org, memberCount, isAdmin);
    return dto;
};
