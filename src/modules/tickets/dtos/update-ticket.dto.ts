export interface UpdateTicketDto {
  title?: string;
  description?: string;
  priority?: 'Low' | 'Medium' | 'High';
  statusId?: string;
  assigneeId?: string;
}