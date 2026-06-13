import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../config/db';

/**
 * Join table for the many-to-many between tickets and platform/versions.
 *
 * A ticket can be observed on several builds (e.g. "Web · 1.1.0" AND
 * "Mobile · 128.80.2"). The single `tickets.platform_version_id` column is
 * retained as the PRIMARY entry (mirrored as the first of this set) for
 * backward compatibility and a compact single-label display.
 */
export interface TicketPlatformVersionAttributes {
  id: string;
  ticketId: string;
  platformVersionId: string;
  organizationId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TicketPlatformVersionCreationAttributes
  extends Optional<TicketPlatformVersionAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class TicketPlatformVersion
  extends Model<TicketPlatformVersionAttributes, TicketPlatformVersionCreationAttributes>
  implements TicketPlatformVersionAttributes
{
  declare id: string;
  declare ticketId: string;
  declare platformVersionId: string;
  declare organizationId: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TicketPlatformVersion.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    ticketId: { type: DataTypes.UUID, allowNull: false, field: 'ticket_id' },
    platformVersionId: { type: DataTypes.UUID, allowNull: false, field: 'platform_version_id' },
    organizationId: { type: DataTypes.UUID, allowNull: false, field: 'organization_id' },
  },
  {
    sequelize,
    tableName: 'ticket_platform_versions',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['ticket_id', 'platform_version_id'], name: 'uniq_ticket_platform_version' },
      { fields: ['ticket_id'], name: 'idx_tpv_ticket' },
      { fields: ['platform_version_id'], name: 'idx_tpv_pv' },
    ],
  },
);
