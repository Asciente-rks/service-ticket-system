import { CreateTicketDto } from '../dtos/create-ticket.dto';
import { TicketResponseDto } from '../dtos/ticket-response.dto';
import { UpdateTicketDto } from '../dtos/update-ticket.dto';
import * as ticketRepository from '../repositories/ticket.repository';
import * as ticketStatusRepository from '../repositories/ticket-status.repository';
import * as userRepository from '../../users/repositories/user.repository';
import * as notificationService from '../../notifications/services/notification.service';
import * as notificationSettingService from '../../users/services/notification-setting.service';
import { ROLES } from '../../../config/roles';
import { STATUSES } from '../../../config/statuses';

const VALID_PRIORITIES = ['Low', 'Medium', 'High'];

export const createTicket = async (ticketData: CreateTicketDto, reporterId: string, reporterRoleId: string): Promise<TicketResponseDto> => {
    if (!VALID_PRIORITIES.includes(ticketData.priority)) {
        throw new Error(`Invalid priority. Allowed values: ${VALID_PRIORITIES.join(', ')}`);
    }
    
    const openStatus = await ticketStatusRepository.findByName('Open');
    
    if (!openStatus) {
        throw new Error('Default ticket status "Open" not found. Please run the seed script.');
    }

    if (ticketData.assigneeId) {
        // Optimized: Basic fetch for assignment validation
        const assignee = await userRepository.findBasicById(ticketData.assigneeId);
        
        if (!assignee) {
            throw new Error('Assignee user not found.');
        }

        const assigneeRoleId = (assignee.roleId || '').toLowerCase();
        const creatorRoleId = (reporterRoleId || '').toLowerCase();
        const superAdminRole = ROLES.SUPER_ADMIN.toLowerCase();
        const adminRole = ROLES.ADMIN.toLowerCase();
        const devRole = ROLES.DEVELOPER.toLowerCase();
        const testerRole = ROLES.TESTER.toLowerCase();

        if (assignee.id !== reporterId) {
            if (assigneeRoleId === superAdminRole) {
                throw new Error('Tickets cannot be assigned to SuperAdmins.');
            }

            if (creatorRoleId === adminRole) {
                if (![devRole, testerRole].includes(assigneeRoleId)) {
                    throw new Error('Admins can only assign tickets to Developers and Testers.');
                }
            } else if (creatorRoleId === testerRole) {
                if (![devRole, testerRole].includes(assigneeRoleId)) {
                    throw new Error('Testers can only assign tickets to Developers and fellow Testers.');
                }
            } else if (creatorRoleId === devRole) {
                if (![devRole, testerRole].includes(assigneeRoleId)) {
                    throw new Error('Developers can only assign tickets to fellow Developers and Testers.');
                }
            }
        }
    }

    const ticket = await ticketRepository.create({
        title: ticketData.title,
        description: ticketData.description,
        priority: ticketData.priority,
        reportedBy: reporterId,
        assignedTo: ticketData.assigneeId || null,
        statusId: STATUSES.OPEN
    });

    // Optimized: Convert the created instance directly instead of re-fetching from DB
    const createdTicket = toTicketResponseDto(ticket);

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

    if (updates.priority && !VALID_PRIORITIES.includes(updates.priority)) {
        throw new Error(`Invalid priority. Allowed values: ${VALID_PRIORITIES.join(', ')}`);
    }
 
    const updatesAny = updates as any;
    if (updatesAny.status) {
        const statusEntity = await ticketStatusRepository.findByName(updatesAny.status);
        if (!statusEntity) {
            throw new Error(`Status "${updatesAny.status}" not found`);
        }
        
        if (statusEntity.name === 'In Progress') {
             updates.assigneeId = userId;
        } else if (statusEntity.name === 'Ready for QA') {
            updates.assigneeId = ticket.reportedBy;
        }

        updates.statusId = statusEntity.id;
        delete updatesAny.status;
    }

    if (updates.assigneeId && ticket.assignedTo !== updates.assigneeId) {
        const newAssigneeId = updates.assigneeId;
        if (newAssigneeId) { 
            // Optimized: Basic fetch for assignment check
            const assignee = await userRepository.findBasicById(newAssigneeId);
            if (!assignee) {
                throw new Error('Assignee user not found');
            }

            const assigneeRoleId = (assignee.roleId || '').toLowerCase();
            const actorRoleId = (roleId || '').toLowerCase();
            const superAdminRole = ROLES.SUPER_ADMIN.toLowerCase();
            const adminRole = ROLES.ADMIN.toLowerCase();
            const devRole = ROLES.DEVELOPER.toLowerCase();
            const testerRole = ROLES.TESTER.toLowerCase();

            if (newAssigneeId !== userId) {
                if (assigneeRoleId === superAdminRole) {
                    throw new Error('Tickets cannot be assigned to SuperAdmins.');
                }

                if (actorRoleId === adminRole) {
                    if (![devRole, testerRole].includes(assigneeRoleId)) {
                        throw new Error('Admins can only assign tickets to Developers and Testers.');
                    }
                } else if (actorRoleId === testerRole) {
                    if (![devRole, testerRole].includes(assigneeRoleId)) {
                        throw new Error('Testers can only assign tickets to Developers and fellow Testers.');
                    }
                } else if (actorRoleId === devRole) {
                    if (![devRole, testerRole].includes(assigneeRoleId)) {
                        throw new Error('Developers can only assign tickets to fellow Developers and Testers.');
                    }
                }
            }
            const settings = await notificationSettingService.getNotificationSettings(newAssigneeId);
            if (settings.notifyAssignedTicket) {
                await notificationService.createNotification({
                    userId: newAssigneeId,
                    ticketId: ticket.id,
                    message: `You have been assigned a ticket: ${ticket.title}`
                });
            }
        }
    }

    const updateData: any = { ...updates };
    if (updateData.assigneeId !== undefined) {
        updateData.assignedTo = updateData.assigneeId;
        delete updateData.assigneeId;
    }

    await ticketRepository.update(id, updateData);
    const updatedTicket = await ticketRepository.findById(id); // Keep one fetch to get associations (reporter/assignee names)

    if (updates.statusId && ticket.statusId !== updates.statusId) {
        const statusName = (updatedTicket as any).status.name;

        if (ticket.reportedBy !== userId) {
            const settings = await notificationSettingService.getNotificationSettings(ticket.reportedBy);
            if (settings.notifyReportedTicket) {
                await notificationService.createNotification({
                    userId: ticket.reportedBy,
                    ticketId: ticket.id,
                    message: `The status of your ticket "${ticket.title}" has been updated to ${statusName}.`
                });
            }
        }

        if (ticket.assignedTo && ticket.assignedTo !== userId) {
            const settings = await notificationSettingService.getNotificationSettings(ticket.assignedTo);
            if (settings.notifyAssignedTicket) {
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
        comment: approvalComment,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt
    };
}