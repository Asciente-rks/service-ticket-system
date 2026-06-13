export interface UpdateTicketDto {
  title?: string;
  collectionId?: string;
  description?: string;
  priority?: 'Low' | 'Medium' | 'High';
  statusId?: string;
  /** @deprecated single-assignee shortcut — kept for backward compatibility. */
  assigneeId?: string;
  /** Full set of assignees. When provided, replaces the ticket's assignee set. */
  assigneeIds?: string[];
  platformVersionId?: string | null;
  jamUrl?: string | null;
}
