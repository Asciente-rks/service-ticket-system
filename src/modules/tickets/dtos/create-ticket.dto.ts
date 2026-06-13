export interface CreateTicketDto {
  title: string;
  collectionId?: string | null;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  /** @deprecated single-assignee shortcut — kept for backward compatibility. */
  assigneeId?: string;
  /** Full set of assignees. The first becomes the primary/lifecycle owner. */
  assigneeIds?: string[];
  platformVersionId?: string | null;
  jamUrl?: string | null;
}
