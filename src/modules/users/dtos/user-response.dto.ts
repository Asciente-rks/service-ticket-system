import { Ticket } from "../../tickets/models/ticket.model";
import { Notification } from "../../notifications/models/notification.model";

export interface UserResponseDto {
    id: string;
    roleId: string;
    name: string;
    email: string;
    role?: { id: string; name: string };
    // Using Partial to only include some fields for the overview
    reportedTickets?: Partial<Ticket>[];
    assignedTickets?: Partial<Ticket>[];
    notifications?: Partial<Notification>[];
}