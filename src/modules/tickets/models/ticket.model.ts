import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../config/db';

export interface TicketsAttributes {
    id: string;
    organizationId: string;
    collectionId: string | null;
    platformVersionId: string | null;
    title: string;
    description: string;
    jamUrl: string | null;
    reportedBy: string;
    assignedTo: string | null;
    statusId: string;
    priority: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface TicketsCreationAttributes extends Optional<TicketsAttributes, 'id' | 'collectionId' | 'platformVersionId' | 'createdAt' | 'updatedAt'> {}

export class Ticket extends Model<TicketsAttributes, TicketsCreationAttributes> implements TicketsAttributes {
    declare id: string;
    declare organizationId: string;
    declare collectionId: string | null;
    declare platformVersionId: string | null;
    declare title: string;
    declare description: string;
    declare jamUrl: string | null;
    declare reportedBy: string;
    declare assignedTo: string | null;
    declare statusId: string;
    declare priority: string;
    declare readonly createdAt?: Date;
    declare readonly updatedAt?: Date;
}

Ticket.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      organizationId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'organization_id',
        references: {
          model: 'organizations',
          key: 'id',
        },
      },
      collectionId: {
        // Which collection (system/product) this ticket belongs to. Nullable
        // for legacy rows; orphans are adopted into the org's default
        // collection by the collections service.
        type: DataTypes.UUID,
        allowNull: true,
        field: 'collection_id',
      },
      platformVersionId: {
        // Optional platform/version (build) this ticket was observed on,
        // chosen from the parent collection's curated list. SET NULL at the
        // app layer if the referenced platform/version is deleted.
        type: DataTypes.UUID,
        allowNull: true,
        field: 'platform_version_id',
      },
      title: {
        // TEXT (not STRING) so titles have no practical length cap.
        type: DataTypes.TEXT,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      jamUrl: {
        // Optional Jam (jam.dev) recording link attached to a bug report.
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'jam_url',
      },
      reportedBy: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'reported_by',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      assignedTo: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'assigned_to',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      statusId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'status_id',
        references: {
          model: 'ticket_statuses',
          key: 'id',
        },
      },
      priority: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'tickets',
      timestamps: true
    }
  );