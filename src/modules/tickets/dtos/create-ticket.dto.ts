export interface CreateTicketDto {
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  assigneeId?: string;
}