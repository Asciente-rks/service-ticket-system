import { Ticket } from '../models/ticket.model';
import { User } from '../../users/models/user.model';
import { TicketStatus } from '../models/ticket-status.model';
import { Approval } from '../models/approval.model';
import { Collection } from '../../collections/models/collection.model';

interface CreateTicketParams {
    organizationId: string;
    collectionId?: string | null;
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
    { model: TicketStatus, as: 'status', attributes: ['id', 'name'] },
    { model: Collection, as: 'collection', attributes: ['id', 'name'] },
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