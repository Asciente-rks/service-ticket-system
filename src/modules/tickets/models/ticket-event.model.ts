import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../config/db';

/**
 * An immutable lifecycle event on a ticket, used to render its timeline:
 * reported, assigned, reassigned, status_changed, approved, rejected.
 * `fromValue`/`toValue` hold human-readable labels (status name, assignee name).
 */
export interface TicketEventAttributes {
  id: string;
  ticketId: string;
  organizationId: string | null;
  actorId: string | null;
  type: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TicketEventCreationAttributes
  extends Optional<TicketEventAttributes, 'id' | 'organizationId' | 'actorId' | 'fromValue' | 'toValue' | 'createdAt' | 'updatedAt'> {}

export class TicketEvent extends Model<TicketEventAttributes, TicketEventCreationAttributes> implements TicketEventAttributes {
  declare id: string;
  declare ticketId: string;
  declare organizationId: string | null;
  declare actorId: string | null;
  declare type: string;
  declare fromValue: string | null;
  declare toValue: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TicketEvent.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    ticketId: { type: DataTypes.UUID, allowNull: false, field: 'ticket_id' },
    organizationId: { type: DataTypes.UUID, allowNull: true, field: 'organization_id' },
    actorId: { type: DataTypes.UUID, allowNull: true, field: 'actor_id' },
    type: { type: DataTypes.STRING(48), allowNull: false },
    fromValue: { type: DataTypes.STRING, allowNull: true, field: 'from_value' },
    toValue: { type: DataTypes.STRING, allowNull: true, field: 'to_value' },
  },
  { sequelize, tableName: 'ticket_events', timestamps: true },
);
