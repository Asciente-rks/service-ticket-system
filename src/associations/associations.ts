import { User } from '../modules/users/models/user.model';
import { Role } from '../modules/users/models/role.model';
import { Ticket } from '../modules/tickets/models/ticket.model';
import { TicketStatus } from '../modules/tickets/models/ticket-status.model';
import { Approval } from '../modules/tickets/models/approval.model';
import { Notification } from '../modules/notifications/models/notification.model';
import { NotificationSettings } from '../modules/users/models/notification-settings.model';
import { Organization } from '../modules/organizations/models/organization.model';

let defined = false;

export const defineAssociations = () => {
    // Guard against double-definition on warm Lambda containers.
    if (defined) return;
    defined = true;

    Role.hasMany(User, { foreignKey: 'roleId', as: 'users' });
    User.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });

    // Multi-tenant: organizations own users and tickets.
    Organization.hasMany(User, { foreignKey: 'organizationId', as: 'members' });
    User.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

    Organization.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

    Organization.hasMany(Ticket, { foreignKey: 'organizationId', as: 'tickets' });
    Ticket.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

    Organization.hasMany(Notification, { foreignKey: 'organizationId', as: 'notifications' });
    Notification.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

    User.hasMany(Ticket, { foreignKey: 'reportedBy', as: 'reportedTickets' });
    Ticket.belongsTo(User, { foreignKey: 'reportedBy', as: 'reporter' });

    User.hasMany(Ticket, { foreignKey: 'assignedTo', as: 'assignedTickets' });
    Ticket.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignee' });

    TicketStatus.hasMany(Ticket, { foreignKey: 'statusId', as: 'tickets' });
    Ticket.belongsTo(TicketStatus, { foreignKey: 'statusId', as: 'status' });

    Ticket.hasMany(Approval, { foreignKey: 'ticketId', as: 'approvals' });
    Approval.belongsTo(Ticket, { foreignKey: 'ticketId', as: 'ticket' });

    User.hasMany(Approval, { foreignKey: 'approverId', as: 'approvalsGiven' });
    Approval.belongsTo(User, { foreignKey: 'approverId', as: 'approver' });

    User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
    Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

    Ticket.hasMany(Notification, { foreignKey: 'ticketId', as: 'notifications' });
    Notification.belongsTo(Ticket, { foreignKey: 'ticketId', as: 'ticket' });

    User.hasOne(NotificationSettings, { foreignKey: 'userId', as: 'notificationSettings' });
    NotificationSettings.belongsTo(User, { foreignKey: 'userId', as: 'user' });

    console.log('Model associations defined.');
};
