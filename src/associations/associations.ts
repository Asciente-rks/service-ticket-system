import { User } from '../modules/users/models/user.model';
import { Role } from '../modules/users/models/role.model';
import { Ticket } from '../modules/tickets/models/ticket.model';
import { TicketStatus } from '../modules/tickets/models/ticket-status.model';
import { Approval } from '../modules/tickets/models/approval.model';
import { Comment } from '../modules/tickets/models/comment.model';
import { TicketEvent } from '../modules/tickets/models/ticket-event.model';
import { Conversation } from '../modules/conversations/models/conversation.model';
import { Message } from '../modules/conversations/models/message.model';
import { AiConversation } from '../modules/ai/models/ai-conversation.model';
import { AiMessage } from '../modules/ai/models/ai-message.model';
import { Collection } from '../modules/collections/models/collection.model';
import { PlatformVersion } from '../modules/collections/models/platform-version.model';
import { TicketAssignee } from '../modules/tickets/models/ticket-assignee.model';
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

    // Collections group tickets per system/product within an organization.
    Organization.hasMany(Collection, { foreignKey: 'organizationId', as: 'collections' });
    Collection.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
    Collection.hasMany(Ticket, { foreignKey: 'collectionId', as: 'tickets' });
    Ticket.belongsTo(Collection, { foreignKey: 'collectionId', as: 'collection' });

    Organization.hasMany(Notification, { foreignKey: 'organizationId', as: 'notifications' });
    Notification.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

    User.hasMany(Ticket, { foreignKey: 'reportedBy', as: 'reportedTickets' });
    Ticket.belongsTo(User, { foreignKey: 'reportedBy', as: 'reporter' });

    User.hasMany(Ticket, { foreignKey: 'assignedTo', as: 'assignedTickets' });
    Ticket.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignee' });

    // Multiple assignees per ticket (the full set). `assignee`/`assignedTo`
    // above remains the primary/lifecycle owner; this is the complete roster.
    Ticket.belongsToMany(User, {
      through: TicketAssignee,
      as: 'assignees',
      foreignKey: 'ticketId',
      otherKey: 'userId',
    });
    User.belongsToMany(Ticket, {
      through: TicketAssignee,
      as: 'assignedTicketsAll',
      foreignKey: 'userId',
      otherKey: 'ticketId',
    });
    Ticket.hasMany(TicketAssignee, { foreignKey: 'ticketId', as: 'assigneeLinks' });
    TicketAssignee.belongsTo(Ticket, { foreignKey: 'ticketId', as: 'ticket' });
    TicketAssignee.belongsTo(User, { foreignKey: 'userId', as: 'user' });

    // Per-collection platform/version catalog; tickets reference one entry.
    Collection.hasMany(PlatformVersion, { foreignKey: 'collectionId', as: 'platformVersions' });
    PlatformVersion.belongsTo(Collection, { foreignKey: 'collectionId', as: 'collection' });
    PlatformVersion.hasMany(Ticket, { foreignKey: 'platformVersionId', as: 'tickets' });
    Ticket.belongsTo(PlatformVersion, { foreignKey: 'platformVersionId', as: 'platformVersion' });

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

    // Ticket comments (threaded) and timeline events.
    Ticket.hasMany(Comment, { foreignKey: 'ticketId', as: 'comments' });
    Comment.belongsTo(Ticket, { foreignKey: 'ticketId', as: 'ticket' });
    User.hasMany(Comment, { foreignKey: 'authorId', as: 'comments' });
    Comment.belongsTo(User, { foreignKey: 'authorId', as: 'author' });
    Comment.hasMany(Comment, { foreignKey: 'parentId', as: 'replies' });
    Comment.belongsTo(Comment, { foreignKey: 'parentId', as: 'parent' });

    Ticket.hasMany(TicketEvent, { foreignKey: 'ticketId', as: 'events' });
    TicketEvent.belongsTo(Ticket, { foreignKey: 'ticketId', as: 'ticket' });
    User.hasMany(TicketEvent, { foreignKey: 'actorId', as: 'ticketEvents' });
    TicketEvent.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

    // Direct-message conversations (1:1) and their messages.
    Conversation.belongsTo(User, { foreignKey: 'user1Id', as: 'user1' });
    Conversation.belongsTo(User, { foreignKey: 'user2Id', as: 'user2' });
    Conversation.hasMany(Message, { foreignKey: 'conversationId', as: 'messages' });
    Message.belongsTo(Conversation, { foreignKey: 'conversationId', as: 'conversation' });
    Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

    // AI assistant conversation threads (per-user) and their messages.
    User.hasMany(AiConversation, { foreignKey: 'userId', as: 'aiConversations' });
    AiConversation.belongsTo(User, { foreignKey: 'userId', as: 'user' });
    AiConversation.hasMany(AiMessage, { foreignKey: 'conversationId', as: 'messages' });
    AiMessage.belongsTo(AiConversation, { foreignKey: 'conversationId', as: 'conversation' });

    console.log('Model associations defined.');
};
