interface TicketUser {
  id: string;
  name: string;
  email: string;
}

export interface TicketPlatformVersion {
  id: string;
  platform: string;
  version: string;
  /** Convenience display label, e.g. "Web · 1.1.0". */
  label: string;
}

export interface TicketResponseDto {
  id: string;
  collectionId: string | null;
  collectionName: string | null;
  title: string;
  description: string;
  jamUrl: string | null;
  status: string;
  priority: 'Low' | 'Medium' | 'High';
  reporter: TicketUser;
  /** Primary/lifecycle owner (first assignee). Kept for backward compatibility. */
  assignee: TicketUser | null;
  /** Full set of assignees (includes the primary). */
  assignees: TicketUser[];
  platformVersionId: string | null;
  platformVersion: TicketPlatformVersion | null;
  reviewedBy: string | null;
  approvalStatus: string | null;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}
