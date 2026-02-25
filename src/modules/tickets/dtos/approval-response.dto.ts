export interface ApprovalResponseDto {
    id: string;
    ticketId: string;
    approverId: string;
    status: string;
    comment: string | null;
    approvedAt: Date | null;
    createdAt: Date;
}