import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../config/db';

export interface NotificationAttributes {
    id: string;
    userId: string;
    ticketId: string;
    message: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface NotificationCreationAttributes extends Omit<NotificationAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
    declare id: string;
    declare userId: string;
    declare ticketId: string;
    declare message: string;
    declare readonly createdAt?: Date;
    declare readonly updatedAt?: Date;
}

Notification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
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
    ticketId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'ticket_id',
      references: {
        model: 'tickets',
        key: 'id',
      },
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'notifications',
    timestamps: true,
  }
);