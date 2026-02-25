import * as approvalRepository from '../repositories/approval.repository';
import * as ticketRepository from '../repositories/ticket.repository';
import { CreateApprovalDto } from '../dtos/create-approval.dto';
import { ApprovalResponseDto } from '../dtos/approval-response.dto';
import { TicketStatus } from '../models/ticket-status.model';
import * as notificationService from '../../notifications/services/notification.service';
import * as notificationSettingService from '../../users/services/notification-setting.service';

export const approveTicket = async (ticketId: string, approverId: string, approvalData: CreateApprovalDto): Promise<ApprovalResponseDto> => {
    if (approvalData.status !== 'Approved' && approvalData.status !== 'Rejected') {
        throw new Error('Invalid status. Allowed values: Approved, Rejected');
    }

    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) {
        throw new Error('Ticket not found');
    }

    const approval = await approvalRepository.create({
        ticketId,
        approverId,
        status: approvalData.status,
        comment: approvalData.comment,
        approvedAt: new Date()
    });

    // Workflow: Update ticket status based on approval decision
    if (approvalData.status === 'Approved') {
        const closedStatus = await TicketStatus.findOne({ where: { name: 'Closed' } });
        if (closedStatus) {
            await ticketRepository.update(ticketId, { statusId: closedStatus.id });
        }
    } else if (approvalData.status === 'Rejected') {
        const inProgressStatus = await TicketStatus.findOne({ where: { name: 'In Progress' } });
        if (inProgressStatus) {
             await ticketRepository.update(ticketId, { statusId: inProgressStatus.id });
        }
    }

    // Trigger Notification for Reporter
    const reporterSettings = await notificationSettingService.getNotificationSettings(ticket.reportedBy);
    
    if (approvalData.status === 'Approved' && reporterSettings.notifyTicketApproved) {
        await notificationService.createNotification({
            userId: ticket.reportedBy,
            ticketId: ticket.id,
            message: `Your ticket "${ticket.title}" has been Approved.`
        });
    } else if (approvalData.status === 'Rejected' && reporterSettings.notifyTicketRejected) {
        await notificationService.createNotification({
            userId: ticket.reportedBy,
            ticketId: ticket.id,
            message: `Your ticket "${ticket.title}" has been Rejected.`
        });
    }

    // Trigger Notification for Assignee
    if (ticket.assignedTo) {
        const assigneeSettings = await notificationSettingService.getNotificationSettings(ticket.assignedTo);
        if (approvalData.status === 'Approved' && assigneeSettings.notifyTicketApproved) {
            await notificationService.createNotification({
                userId: ticket.assignedTo,
                ticketId: ticket.id,
                message: `Ticket "${ticket.title}" assigned to you has been Approved.`
            });
        } else if (approvalData.status === 'Rejected' && assigneeSettings.notifyTicketRejected) {
            await notificationService.createNotification({
                userId: ticket.assignedTo,
                ticketId: ticket.id,
                message: `Ticket "${ticket.title}" assigned to you has been Rejected.`
            });
        }
    }

    return toApprovalResponseDto(approval);
};

const toApprovalResponseDto = (approval: any): ApprovalResponseDto => {
    return {
        id: approval.id,
        ticketId: approval.ticketId,
        approverId: approval.approverId,
        status: approval.status,
        comment: approval.comment,
        approvedAt: approval.approvedAt,
        createdAt: approval.createdAt
    };
};