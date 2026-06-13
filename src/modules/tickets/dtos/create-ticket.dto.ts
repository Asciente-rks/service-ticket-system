export interface CreateTicketDto {
  title: string;
  collectionId?: string | null;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  /** @deprecated single-assignee shortcut — kept for backward compatibility. */
  assigneeId?: string;
  /** Full set of assignees. The first becomes the primary/lifecycle owner. */
  assigneeIds?: string[];
  /** @deprecated single platform/version — kept for backward compatibility. */
  platformVersionId?: string | null;
  /** Full set of platform/versions the ticket was observed on. */
  platformVersionIds?: string[];
  jamUrl?: string | null;
}
