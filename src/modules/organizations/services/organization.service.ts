import * as organizationRepository from '../repositories/organization.repository';
import * as userRepository from '../../users/repositories/user.repository';
import * as notificationSettingService from '../../users/services/notification-setting.service';
import { signUserToken } from '../../../utils/token';
import { ROLES } from '../../../config/roles';
import { sequelize } from '../../../config/db';
import { Organization } from '../models/organization.model';
import { User } from '../../users/models/user.model';
import { Ticket } from '../../tickets/models/ticket.model';
import { Approval } from '../../tickets/models/approval.model';
import { Notification } from '../../notifications/models/notification.model';
import { NotificationSettings } from '../../users/models/notification-settings.model';
import { Op } from 'sequelize';

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

const toOrganizationDto = (
    org: any,
    memberCount: number,
    includeInvite: boolean,
    isOwner = false,
) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    memberCount,
    isOwner,
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

export const getMyOrganization = async (
    organizationId: string,
    isAdmin: boolean,
    userId?: string,
) => {
    const org = await organizationRepository.findById(organizationId);
    if (!org) return null;
    const memberCount = await organizationRepository.countMembers(organizationId);
    const isOwner = !!userId && String((org as any).ownerId) === String(userId);
    const dto = toOrganizationDto(org, memberCount, isAdmin, isOwner);
    return dto;
};

/** Rename an organization. Caller must be an Admin/SuperAdmin of the org (route-gated). */
export const renameOrganization = async (
    organizationId: string,
    name: string,
) => {
    const org = await organizationRepository.findById(organizationId);
    if (!org) {
        const err: any = new Error('Organization not found.');
        err.statusCode = 404;
        throw err;
    }

    const trimmed = name.trim();
    await organizationRepository.update(organizationId, { name: trimmed });

    const refreshed = await organizationRepository.findById(organizationId);
    const memberCount = await organizationRepository.countMembers(organizationId);
    return toOrganizationDto(refreshed, memberCount, true);
};

/** Issue a fresh invite code, invalidating the previous one. */
export const regenerateInviteCode = async (organizationId: string) => {
    const org = await organizationRepository.findById(organizationId);
    if (!org) {
        const err: any = new Error('Organization not found.');
        err.statusCode = 404;
        throw err;
    }

    const inviteCode = await generateUniqueInviteCode();
    await organizationRepository.update(organizationId, { inviteCode } as any);

    return { inviteCode };
};

/**
 * Permanently delete an organization and all of its data. Owner-only.
 *
 * Members (including the owner) are detached — their accounts survive but are
 * reset to "no organization / no role" so they're routed back to onboarding.
 * All org-scoped tickets, approvals and notifications are removed. Runs in a
 * transaction so a partial failure rolls everything back. Returns a fresh token
 * for the owner reflecting their now org-less state.
 */
export const deleteOrganization = async (organizationId: string, userId: string) => {
    const org = await organizationRepository.findById(organizationId);
    if (!org) {
        const err: any = new Error('Organization not found.');
        err.statusCode = 404;
        throw err;
    }

    if (String((org as any).ownerId) !== String(userId)) {
        const err: any = new Error('Only the organization owner can delete it.');
        err.statusCode = 403;
        throw err;
    }

    const owner = await userRepository.findBasicById(userId);

    await sequelize.transaction(async (transaction) => {
        const tickets = await Ticket.findAll({
            where: { organizationId },
            attributes: ['id'],
            transaction,
        });
        const ticketIds = tickets.map((t: any) => t.id);

        if (ticketIds.length) {
            await Approval.destroy({ where: { ticketId: { [Op.in]: ticketIds } }, transaction });
        }

        await Notification.destroy({ where: { organizationId }, transaction });
        await Ticket.destroy({ where: { organizationId }, transaction });

        const members = await User.findAll({
            where: { organizationId },
            attributes: ['id'],
            transaction,
        });
        const memberIds = members.map((m: any) => m.id);

        if (memberIds.length) {
            await NotificationSettings.destroy({
                where: { userId: { [Op.in]: memberIds } },
                transaction,
            });
            // Detach members: keep accounts, drop org membership + role.
            await User.update(
                { organizationId: null, roleId: null },
                { where: { organizationId }, transaction },
            );
        }

        await Organization.destroy({ where: { id: organizationId }, transaction });
    });

    const token = signUserToken({
        id: userId,
        roleId: null,
        organizationId: null,
        email: (owner as any)?.email ?? '',
        role: '',
    });

    return { success: true, token };
};
