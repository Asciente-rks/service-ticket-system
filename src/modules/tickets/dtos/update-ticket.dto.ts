export interface UpdateTicketDto {
  title?: string;
  collectionId?: string;
  description?: string;
  priority?: 'Low' | 'Medium' | 'High';
  statusId?: string;
  assigneeId?: string;
  jamUrl?: string | null;
}
