export interface CreateTicketDto {
  title: string;
  collectionId?: string | null;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  assigneeId?: string;
  jamUrl?: string | null;
}
