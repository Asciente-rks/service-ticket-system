import * as approvalRepository from '../repositories/approval.repository';
import * as ticketRepository from '../repositories/ticket.repository';
import * as ticketStatusRepository from '../repositories/ticket-status.repository';
import { CreateApprovalDto } from '../dtos/create-approval.dto';
import { ApprovalResponseDto } from '../dtos/approval-response.dto';
import * as notificationService from '../../notifications/services/notification.service';
import * as notificationSettingService from '../../users/services/notification-setting.service';
import * as userRepository from '../../users/repositories/user.repository';
import * as roleRepository from '../../users/repositories/role.repository';

export const approveTicket = async (ticketId: string, approverId: string, approvalData: CreateApprovalDto): Promise<ApprovalResponseDto> => {
    if (approvalData.status !== 'Approved' && approvalData.status !== 'Rejected') {
        throw new Error('Invalid status. Allowed values: Approved, Rejected');
    }

    const approver = await userRepository.findById(approverId);
    if (!approver) throw new Error('Approver not found');

    const approverRole = await roleRepository.findById(approver.roleId);
    if (!approverRole || (approverRole.name !== 'Admin' && approverRole.name !== 'SuperAdmin')) {
        throw new Error('Only Admins and SuperAdmins can approve tickets.');
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

    if (approvalData.status === 'Approved') {
        const resolvedStatus = await ticketStatusRepository.findByName('Resolved');
        if (resolvedStatus) {
            await ticketRepository.update(ticketId, { statusId: resolvedStatus.id });
        }
    } else if (approvalData.status === 'Rejected') {
        const errorPersistsStatus = await ticketStatusRepository.findByName('Error Persists');
        if (errorPersistsStatus) {
             await ticketRepository.update(ticketId, { statusId: errorPersistsStatus.id });
        }
    }

    const reporterSettings = await notificationSettingService.getNotificationSettings(ticket.reportedBy);
    const shouldNotifyReporter = (approvalData.status === 'Approved' && reporterSettings.notifyTicketApproved) ||
                                 (approvalData.status === 'Rejected' && reporterSettings.notifyTicketRejected);

    if (shouldNotifyReporter) {
        await notificationService.createNotification({
            userId: ticket.reportedBy,
            ticketId: ticket.id,
            message: `Your ticket "${ticket.title}" has been ${approvalData.status}.`
        });
    }

    if (ticket.assignedTo) {
        const assigneeSettings = await notificationSettingService.getNotificationSettings(ticket.assignedTo);
        const shouldNotifyAssignee = (approvalData.status === 'Approved' && assigneeSettings.notifyTicketApproved) ||
                                     (approvalData.status === 'Rejected' && assigneeSettings.notifyTicketRejected);

        if (shouldNotifyAssignee) {
            await notificationService.createNotification({
                userId: ticket.assignedTo,
                ticketId: ticket.id,
                message: `Ticket "${ticket.title}" assigned to you has been ${approvalData.status}.`
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