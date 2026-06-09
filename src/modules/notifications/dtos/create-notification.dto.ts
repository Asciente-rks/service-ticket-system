export interface CreateNotificationDto {
    userId: string;
    ticketId: string;
    organizationId?: string | null;
    message: string;
}
