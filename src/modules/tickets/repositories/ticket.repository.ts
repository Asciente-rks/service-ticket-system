import { Ticket } from '../models/ticket.model';
import { User } from '../../users/models/user.model';
import { TicketStatus } from '../models/ticket-status.model';
import { Approval } from '../models/approval.model';
import { UpdateTicketDto } from '../dtos/update-ticket.dto';

interface CreateTicketParams {
    title: string;
    description: string;
    priority: string;
    reportedBy: string;
    assignedTo: string | null;
    statusId: string;
}

export const create = async (ticketData: CreateTicketParams) => {
    return await Ticket.create(ticketData as any);
};

export const findAll = async (whereClause: any = {}) => {
    return await Ticket.findAll({
        where: whereClause,
        include: [
            { model: User, as: 'reporter' },
            { model: User, as: 'assignee' },
            { model: TicketStatus, as: 'status' },
            { 
                model: Approval, 
                as: 'approvals',
                include: [{ model: User, as: 'approver' }]
            }
        ]
    });
};

export const findById = async (id: string) => {
    return await Ticket.findByPk(id, {
        include: [
            { model: User, as: 'reporter' },
            { model: User, as: 'assignee' },
            { model: TicketStatus, as: 'status' },
            { 
                model: Approval, 
                as: 'approvals',
                include: [{ model: User, as: 'approver' }]
            }
        ]
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