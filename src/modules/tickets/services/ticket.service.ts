import { TicketStatus } from '../models/ticket-status.model';
import { CreateTicketDto } from '../dtos/create-ticket.dto';
import { TicketResponseDto } from '../dtos/ticket-response.dto';
import { UpdateTicketDto } from '../dtos/update-ticket.dto';
import * as ticketRepository from '../repositories/ticket.repository';
import { Role } from '../../users/models/role.model';
import * as notificationService from '../../notifications/services/notification.service';
import * as notificationSettingService from '../../users/services/notification-setting.service';

const VALID_PRIORITIES = ['Low', 'Medium', 'High'];

export const createTicket = async (ticketData: CreateTicketDto, reporterId: string): Promise<TicketResponseDto> => {
    if (!VALID_PRIORITIES.includes(ticketData.priority)) {
        throw new Error(`Invalid priority. Allowed values: ${VALID_PRIORITIES.join(', ')}`);
    }

    const openStatus = await TicketStatus.findOne({ where: { name: 'Open' } });
    
    if (!openStatus) {
        throw new Error('Default ticket status "Open" not found. Please run the seed script.');
    }

    const ticket = await ticketRepository.create({
        title: ticketData.title,
        description: ticketData.description,
        priority: ticketData.priority,
        reportedBy: reporterId,
        assignedTo: ticketData.assigneeId || null,
        statusId: openStatus.id
    });

    const createdTicket = await getTicketById(ticket.id);
    if (!createdTicket) throw new Error('Error fetching created ticket');

    if (ticket.assignedTo) {
        const settings = await notificationSettingService.getNotificationSettings(ticket.assignedTo);
        if (settings.notifyAssignedTicket) {
            await notificationService.createNotification({
                userId: ticket.assignedTo,
                ticketId: ticket.id,
                message: `You have been assigned a new ticket: ${ticket.title}`
            });
        }
    }
    return createdTicket;
}

export const getAllTickets = async (userId: string, roleId: string): Promise<TicketResponseDto[]> => {
    const role = await Role.findByPk(roleId);
    if (!role) throw new Error('Role not found');

    const whereClause = {};

    const tickets = await ticketRepository.findAll(whereClause);

    return tickets.map(ticket => toTicketResponseDto(ticket));
};

export const getTicketById = async (id: string): Promise<TicketResponseDto | null> => {
    const ticket = await ticketRepository.findById(id);

    if (!ticket) return null;

    return toTicketResponseDto(ticket);
}

export const updateTicket = async (id: string, updates: UpdateTicketDto, userId: string, roleId: string): Promise<TicketResponseDto | null> => {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) return null;
    
    const role = await Role.findByPk(roleId);
    if (!role) throw new Error('Role not found');

    if (updates.priority && !VALID_PRIORITIES.includes(updates.priority)) {
        throw new Error(`Invalid priority. Allowed values: ${VALID_PRIORITIES.join(', ')}`);
    }

    const updatesAny = updates as any;
    if (updatesAny.status) {
        const statusEntity = await TicketStatus.findOne({ where: { name: updatesAny.status } });
        if (!statusEntity) {
            throw new Error(`Status "${updatesAny.status}" not found`);
        }
        updates.statusId = statusEntity.id;
        delete updatesAny.status;
    }

    if (updates.statusId) {
        const targetStatus = await TicketStatus.findByPk(updates.statusId);
        if (targetStatus) {
            if (role.name === 'Tester') {
                const allowedStatuses = ['New', 'In Testing', 'Done', 'Reopened', 'Open', 'Resolved']; // Including seed defaults for compatibility
                if (!allowedStatuses.includes(targetStatus.name)) {
                    throw new Error(`Tester cannot change status to "${targetStatus.name}". Allowed: ${allowedStatuses.join(', ')}`);
                }
            } else if (role.name === 'Developer') {
                const allowedStatuses = ['In Progress', 'Ready for QA', 'Reopened'];
                if (!allowedStatuses.includes(targetStatus.name)) {
                    throw new Error(`Developer cannot change status to "${targetStatus.name}". Allowed: ${allowedStatuses.join(', ')}`);
                }
            }
        }
    }

    await ticketRepository.update(id, updates);
    
    const updatedTicket = await ticketRepository.findById(id);
    if (!updatedTicket) return null;

    if (updates.statusId && ticket.statusId !== updates.statusId) {
        const statusName = (updatedTicket as any).status.name;
        
        if (ticket.reportedBy !== userId) {
            const reporterSettings = await notificationSettingService.getNotificationSettings(ticket.reportedBy);
            if (reporterSettings.notifyReportedTicket) {
                await notificationService.createNotification({
                    userId: ticket.reportedBy,
                    ticketId: ticket.id,
                    message: `The status of your ticket "${ticket.title}" has been updated to ${statusName}.`
                });
            }
        }

        if (ticket.assignedTo && ticket.assignedTo !== userId) {
            const assigneeSettings = await notificationSettingService.getNotificationSettings(ticket.assignedTo);
            if (assigneeSettings.notifyReportedTicket) {
                await notificationService.createNotification({
                    userId: ticket.assignedTo,
                    ticketId: ticket.id,
                    message: `The status of ticket "${ticket.title}" assigned to you has been updated to ${statusName}.`
                });
            }
        }
    }
    return toTicketResponseDto(updatedTicket);
};

const toTicketResponseDto = (ticket: any): TicketResponseDto => {
    let reviewedBy = null;
    let approvalStatus = null;
    let approvalComment = null;

    if (ticket.approvals && ticket.approvals.length > 0) {
        const latestApproval = ticket.approvals.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        
        if (latestApproval) {
            reviewedBy = latestApproval.approver ? latestApproval.approver.name : null;
            approvalStatus = latestApproval.status;
            approvalComment = latestApproval.comment;
        }
    }

    return {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status.name,
        priority: ticket.priority,
        reporter: {
            id: ticket.reporter.id,
            name: ticket.reporter.name,
            email: ticket.reporter.email
        },
        assignee: ticket.assignee ? {
            id: ticket.assignee.id,
            name: ticket.assignee.name,
            email: ticket.assignee.email
        } : null,
        reviewedBy,
        approvalStatus,
        approvalComment,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt
    };
}