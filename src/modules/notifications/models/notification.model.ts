import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../config/db';

export interface NotificationAttributes {
    id: string;
    userId: string;
    message: string;
    read: boolean;
    ticketId?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface NotificationCreationAttributes extends Optional<NotificationAttributes, 'id' | 'read' | 'createdAt' | 'updatedAt'> {}

export class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
    declare id: string;
    declare userId: string;
    declare message: string;
    declare read: boolean;
    declare ticketId?: string;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

Notification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    message: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    ticketId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'ticket_id',
      references: {
        model: 'tickets',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'notifications',
    timestamps: true,
  }
);