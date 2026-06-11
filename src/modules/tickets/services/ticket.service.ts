import { CreateTicketDto } from '../dtos/create-ticket.dto';
import { TicketResponseDto } from '../dtos/ticket-response.dto';
import { UpdateTicketDto } from '../dtos/update-ticket.dto';
import * as ticketRepository from '../repositories/ticket.repository';
import * as ticketStatusRepository from '../repositories/ticket-status.repository';
import * as userRepository from '../../users/repositories/user.repository';
import * as notificationService from '../../notifications/services/notification.service';
import * as notificationRepository from '../../notifications/repositories/notification.repository';
import * as notificationSettingService from '../../users/services/notification-setting.service';
import * as ticketEventService from './ticket-event.service';
import * as commentRepository from '../repositories/comment.repository';
import * as ticketEventRepository from '../repositories/ticket-event.repository';
import { ROLES } from '../../../config/roles';
import { STATUSES } from '../../../config/statuses';
import * as collectionService from '../../collections/services/collection.service';

const VALID_PRIORITIES = ['Low', 'Medium', 'High'];

export const createTicket = async (ticketData: CreateTicketDto, reporterId: string, reporterRoleId: string, organizationId: string): Promise<TicketResponseDto> => {
    if (!VALID_PRIORITIES.includes(ticketData.priority)) {
        throw new Error(`Invalid priority. Allowed values: ${VALID_PRIORITIES.join(', ')}`);
    }

    const openStatus = await ticketStatusRepository.findByName('Open');

    if (!openStatus) {
        throw new Error('Default ticket status "Open" not found. Please run the seed script.');
    }

    if (ticketData.assigneeId) {
        const assignee = await userRepository.findBasicById(ticketData.assigneeId);

        if (!assignee) {
            throw new Error('Assignee user not found.');
        }

        if (String((assignee as any).organizationId) !== String(organizationId)) {
            throw new Error('Assignee must belong to your organization.');
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

    // Every ticket lives in a collection: validate the requested one belongs
    // to this org, or fall back to the org's default collection.
    let collectionId: string;
    if (ticketData.collectionId) {
        const collection = await collectionService.assertCollectionInOrg(organizationId, ticketData.collectionId);
        collectionId = collection.id;
    } else {
        const collection = await collectionService.getDefaultCollection(organizationId, reporterId);
        collectionId = collection.id;
    }

    const ticket = await ticketRepository.create({
        organizationId,
        collectionId,
        title: ticketData.title,
        description: ticketData.description,
        jamUrl: ticketData.jamUrl ?? null,
        priority: ticketData.priority,
        reportedBy: reporterId,
        assignedTo: ticketData.assigneeId || null,
        statusId: STATUSES.OPEN
    });

    const ticketWithAssociations = await ticketRepository.findById(ticket.id);
    if (!ticketWithAssociations) throw new Error('Error fetching created ticket');

    const createdTicket = toTicketResponseDto(ticketWithAssociations);

    // Timeline: ticket reported (+ initial assignment if any).
    await ticketEventService.logEvent({ ticketId: ticket.id, organizationId, actorId: reporterId, type: 'reported' });
    if (ticket.assignedTo) {
        await ticketEventService.logEvent({
            ticketId: ticket.id,
            organizationId,
            actorId: reporterId,
            type: 'assigned',
            toValue: (ticketWithAssociations as any).assignee?.name ?? null,
        });
    }

    if (ticket.assignedTo) {
        const settings = await notificationSettingService.getNotificationSettings(ticket.assignedTo);
        if (settings.notifyAssignedTicket) {
            notificationService.createNotification({
                userId: ticket.assignedTo,
                ticketId: ticket.id,
                organizationId,
                message: `You have been assigned a new ticket: ${ticket.title}`
            }).catch(err => console.error("Notification failed:", err));
        }
    }
    return createdTicket;
}

export const getAllTickets = async (userId: string, roleId: string, organizationId: string, collectionId?: string): Promise<TicketResponseDto[]> => {
    const whereClause: any = { organizationId };
    if (collectionId) whereClause.collectionId = collectionId;

    const tickets = await ticketRepository.findAll(whereClause);

    return tickets.map(ticket => toTicketResponseDto(ticket));
};

export const getTicketById = async (id: string, organizationId: string): Promise<TicketResponseDto | null> => {
    const ticket = await ticketRepository.findById(id);

    if (!ticket) return null;
    if (String((ticket as any).organizationId) !== String(organizationId)) return null;

    return toTicketResponseDto(ticket);
}

export const deleteTicket = async (id: string, organizationId: string, userId: string, roleId: string): Promise<boolean> => {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) return false;

    // Tenant isolation: never act on another organization's ticket.
    if (String((ticket as any).organizationId) !== String(organizationId)) return false;

    const actorRole = (roleId || '').toLowerCase();
    const isAdmin =
        actorRole === ROLES.SUPER_ADMIN.toLowerCase() ||
        actorRole === ROLES.ADMIN.toLowerCase();
    const isReporter = String(ticket.reportedBy) === String(userId);

    // Admins/SuperAdmins can delete any ticket in their org; reporters can delete their own.
    if (!isAdmin && !isReporter) {
        const err: any = new Error('You are not allowed to delete this ticket.');
        err.statusCode = 403;
        throw err;
    }

    // Remove dependent rows first so nothing is orphaned (notifications, comments,
    // timeline events). Notifications have no DB cascade, so always clean explicitly.
    await notificationRepository.deleteByTicketId(id);
    await commentRepository.deleteByTicket(id);
    await ticketEventRepository.deleteByTicket(id);

    await ticketRepository.remove(id);
    return true;
};

export const updateTicket = async (id: string, updates: UpdateTicketDto, userId: string, roleId: string, organizationId: string): Promise<TicketResponseDto | null> => {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) return null;
    if (String((ticket as any).organizationId) !== String(organizationId)) return null;

    if (updates.priority && !VALID_PRIORITIES.includes(updates.priority)) {
        throw new Error(`Invalid priority. Allowed values: ${VALID_PRIORITIES.join(', ')}`);
    }

    // Moving a ticket between collections: target must belong to this org.
    if (updates.collectionId !== undefined) {
        if (updates.collectionId) {
            await collectionService.assertCollectionInOrg(organizationId, updates.collectionId);
        } else {
            delete (updates as any).collectionId; // never detach a ticket from all collections
        }
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
            const assignee = await userRepository.findBasicById(newAssigneeId);
            if (!assignee) {
                throw new Error('Assignee user not found');
            }

            if (String((assignee as any).organizationId) !== String(organizationId)) {
                throw new Error('Assignee must belong to your organization.');
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
                    organizationId,
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
    const updatedTicket = await ticketRepository.findById(id);

    // Timeline: log assignment/reassignment and status transitions based on the
    // actual before/after saved values (catches status-driven auto-reassignments).
    const beforeAssignee = (ticket as any).assignedTo ? String((ticket as any).assignedTo) : null;
    const afterAssignee = (updatedTicket as any).assignedTo ? String((updatedTicket as any).assignedTo) : null;
    if (beforeAssignee !== afterAssignee) {
        await ticketEventService.logEvent({
            ticketId: id,
            organizationId,
            actorId: userId,
            type: beforeAssignee ? 'reassigned' : 'assigned',
            fromValue: (ticket as any).assignee?.name ?? null,
            toValue: (updatedTicket as any).assignee?.name ?? null,
        });
    }
    const beforeStatus = (ticket as any).status?.name ?? null;
    const afterStatus = (updatedTicket as any).status?.name ?? null;
    if (beforeStatus !== afterStatus) {
        await ticketEventService.logEvent({
            ticketId: id,
            organizationId,
            actorId: userId,
            type: 'status_changed',
            fromValue: beforeStatus,
            toValue: afterStatus,
        });
    }

    if (updates.statusId && ticket.statusId !== updates.statusId) {
        const statusName = (updatedTicket as any).status.name;

        if (ticket.reportedBy !== userId) {
            const settings = await notificationSettingService.getNotificationSettings(ticket.reportedBy);
            if (settings.notifyReportedTicket) {
                await notificationService.createNotification({
                    userId: ticket.reportedBy,
                    ticketId: ticket.id,
                    organizationId,
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
                    organizationId,
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
        collectionId: ticket.collectionId ?? ticket.collection?.id ?? null,
        collectionName: ticket.collection?.name ?? null,
        title: ticket.title,
        description: ticket.description,
        jamUrl: ticket.jamUrl ?? null,
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