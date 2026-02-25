export interface CreateApprovalDto {
    status: 'Approved' | 'Rejected';
    comment?: string;
}