import { Op } from 'sequelize';
import { Ticket } from '../models/ticket.model';
import { TicketAssignee } from '../models/ticket-assignee.model';
import { User } from '../../users/models/user.model';
import { TicketStatus } from '../models/ticket-status.model';
import { Approval } from '../models/approval.model';
import { Collection } from '../../collections/models/collection.model';
import { PlatformVersion } from '../../collections/models/platform-version.model';

interface CreateTicketParams {
    organizationId: string;
    collectionId?: string | null;
    platformVersionId?: string | null;
    title: string;
    description: string;
    priority: string;
    reportedBy: string;
    assignedTo: string | null;
    statusId: string;
    jamUrl?: string | null;
}

export const create = async (ticketData: CreateTicketParams) => {
    return await Ticket.create(ticketData as any);
};

const fullInclude = [
    { model: User, as: 'reporter', attributes: ['id', 'name', 'email'] },
    { model: User, as: 'assignee', attributes: ['id', 'name', 'email'] },
    { model: User, as: 'assignees', attributes: ['id', 'name', 'email'], through: { attributes: [] } },
    { model: TicketStatus, as: 'status', attributes: ['id', 'name'] },
    { model: Collection, as: 'collection', attributes: ['id', 'name'] },
    { model: PlatformVersion, as: 'platformVersion', attributes: ['id', 'platform', 'version'] },
    {
        model: Approval,
        as: 'approvals',
        include: [{ model: User, as: 'approver', attributes: ['id', 'name'] }]
    }
];

export const findAll = async (whereClause: any = {}) => {
    return await Ticket.findAll({
        where: whereClause,
        include: fullInclude
    });
};

export const findById = async (id: string) => {
    return await Ticket.findByPk(id, {
        include: fullInclude
    });
};

export const update = async (id: string, updates: any) => {
    const ticket = await Ticket.findByPk(id);
    if (!ticket) return null;
    return await ticket.update(updates);
};

export const remove = async (id: string) => {
    const ticket = await Ticket.findByPk(id);
    if (!ticket) return null;
    return await ticket.destroy();
};

/** Ticket ids in an org where the given user is one of the (many) assignees. */
export const findTicketIdsAssignedToUser = async (
    organizationId: string,
    userId: string,
): Promise<string[]> => {
    const links = await TicketAssignee.findAll({
        where: { organizationId, userId },
        attributes: ['ticketId'],
    });
    return links.map((l: any) => String(l.ticketId));
};

/**
 * Replace a ticket's assignee set with exactly `userIds` (deduped). Adds the
 * missing links and removes the ones no longer present — all scoped to the
 * ticket's organization for tenant safety.
 */
export const setAssignees = async (
    ticketId: string,
    organizationId: string,
    userIds: string[],
    actorId: string | null = null,
): Promise<void> => {
    const desired = Array.from(new Set(userIds.map((u) => String(u)))).filter(Boolean);

    const existing = await TicketAssignee.findAll({ where: { ticketId } });
    const existingIds = new Set(existing.map((e: any) => String(e.userId)));
    const desiredSet = new Set(desired);

    const toRemove = existing.filter((e: any) => !desiredSet.has(String(e.userId)));
    const toAdd = desired.filter((u) => !existingIds.has(u));

    if (toRemove.length) {
        await TicketAssignee.destroy({
            where: { ticketId, userId: { [Op.in]: toRemove.map((e: any) => String(e.userId)) } },
        });
    }
    if (toAdd.length) {
        await TicketAssignee.bulkCreate(
            toAdd.map((userId) => ({ ticketId, userId, organizationId, createdBy: actorId })),
            { ignoreDuplicates: true },
        );
    }
};

/** Add a single user to the assignee set if not already present (no removals). */
export const addAssignee = async (
    ticketId: string,
    organizationId: string,
    userId: string,
    actorId: string | null = null,
): Promise<void> => {
    await TicketAssignee.findOrCreate({
        where: { ticketId, userId },
        defaults: { ticketId, userId, organizationId, createdBy: actorId } as any,
    });
};
