import { Approval } from '../models/approval.model';

interface CreateApprovalParams {
    ticketId: string;
    approverId: string;
    status: 'Approved' | 'Rejected';
    comment?: string;
    approvedAt: Date;
}

export const create = async (data: CreateApprovalParams) => {
    return await Approval.create(data);
};

export const findAllByTicketId = async (ticketId: string) => {
    return await Approval.findAll({ where: { ticketId } });
};