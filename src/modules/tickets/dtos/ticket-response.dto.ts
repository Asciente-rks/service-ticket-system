interface TicketUser {
  id: string;
  name: string;
  email: string;
}

export interface TicketResponseDto {
  id: string;
  title: string;
  description: string;
  jamUrl: string | null;
  status: string;
  priority: 'Low' | 'Medium' | 'High';
  reporter: TicketUser;
  assignee: TicketUser | null;
  reviewedBy: string | null;
  approvalStatus: string | null;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}