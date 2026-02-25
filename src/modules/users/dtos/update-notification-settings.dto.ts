export interface UpdateNotificationSettingsDto {
    notifyAssignedTicket?: boolean;
    notifyReportedTicket?: boolean;
    notifyTicketApproved?: boolean;
    notifyTicketRejected?: boolean;
}