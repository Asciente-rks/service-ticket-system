import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../config/db';

/**
 * Join table for the many-to-many between tickets and their assignees.
 *
 * A ticket can have several assignees. The single `tickets.assigned_to`
 * column is retained as the PRIMARY/lifecycle owner (it drives status-based
 * auto-reassignment and is mirrored as the first member of this set), so all
 * existing behaviour keeps working while the full set lives here. Tenant
 * isolation is enforced by always scoping queries to `organization_id`.
 */
export interface TicketAssigneeAttributes {
  id: string;
  ticketId: string;
  userId: string;
  organizationId: string;
  createdBy: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TicketAssigneeCreationAttributes
  extends Optional<TicketAssigneeAttributes, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'> {}

export class TicketAssignee
  extends Model<TicketAssigneeAttributes, TicketAssigneeCreationAttributes>
  implements TicketAssigneeAttributes
{
  declare id: string;
  declare ticketId: string;
  declare userId: string;
  declare organizationId: string;
  declare createdBy: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TicketAssignee.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    ticketId: { type: DataTypes.UUID, allowNull: false, field: 'ticket_id' },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    organizationId: { type: DataTypes.UUID, allowNull: false, field: 'organization_id' },
    createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    tableName: 'ticket_assignees',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['ticket_id', 'user_id'], name: 'uniq_ticket_assignee' },
      { fields: ['user_id'], name: 'idx_ticket_assignees_user' },
      { fields: ['ticket_id'], name: 'idx_ticket_assignees_ticket' },
    ],
  },
);
