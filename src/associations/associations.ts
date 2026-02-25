import { Role } from '../modules/users/models/role.model';
import { User } from '../modules/users/models/user.model';
import { TicketStatus } from '../modules/tickets/models/ticket-status.model';
import { Ticket } from '../modules/tickets/models/ticket.model';
import { Approval } from '../modules/tickets/models/approval.model';
import { NotificationSettings } from '../modules/users/models/notification-settings.model';
import { Notification } from '../modules/notifications/models/notification.model';

export const defineAssociations = () => {
  Role.hasMany(User, { foreignKey: 'roleId', as: 'users' });
  User.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });

  User.hasMany(Ticket, { foreignKey: 'reportedBy', as: 'reportedTickets' });
  Ticket.belongsTo(User, { foreignKey: 'reportedBy', as: 'reporter' });

  User.hasMany(Ticket, { foreignKey: 'assignedTo', as: 'assignedTickets' });
  Ticket.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignee' });

  TicketStatus.hasMany(Ticket, { foreignKey: 'statusId', as: 'tickets' });
  Ticket.belongsTo(TicketStatus, { foreignKey: 'statusId', as: 'status' });

  Ticket.hasMany(Approval, { foreignKey: 'ticketId', as: 'approvals' });
  Approval.belongsTo(Ticket, { foreignKey: 'ticketId', as: 'ticket' });

  User.hasMany(Approval, { foreignKey: 'approverId', as: 'approvals' });
  Approval.belongsTo(User, { foreignKey: 'approverId', as: 'approver' });

  User.hasOne(NotificationSettings, { foreignKey: 'userId', as: 'settings' });
  NotificationSettings.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
  Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  Ticket.hasMany(Notification, { foreignKey: 'ticketId', as: 'notifications' });
  Notification.belongsTo(Ticket, { foreignKey: 'ticketId', as: 'ticket' });
};