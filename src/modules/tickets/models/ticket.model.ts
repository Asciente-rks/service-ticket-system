import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../config/db';

export interface TicketsAttributes {
    id: string;
    title: string;
    description: string;
    reportedBy: string;
    assignedTo: string;
    statusId: string;
    priority: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface TicketsCreationAttributes extends Omit<TicketsAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class Ticket extends Model<TicketsAttributes, TicketsCreationAttributes> implements TicketsAttributes {
    declare id: string;
    declare title: string;
    declare description: string;
    declare reportedBy: string;
    declare assignedTo: string;
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
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
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
          model: 'ticket_status',
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