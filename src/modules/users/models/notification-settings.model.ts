import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../config/db';

export interface NotificationSettingsAttributes {
    id: string;
    userId: string;
    notifyAssignedTicket: boolean;
    notifyReportedTicket: boolean;
    notifyTicketApproved: boolean;
    notifyTicketRejected: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface NotificationSettingsCreationAttributes extends Optional<NotificationSettingsAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class NotificationSettings extends Model<NotificationSettingsAttributes, NotificationSettingsCreationAttributes> implements NotificationSettingsAttributes {
    declare id: string;
    declare userId: string;
    declare notifyAssignedTicket: boolean;
    declare notifyReportedTicket: boolean;
    declare notifyTicketApproved: boolean;
    declare notifyTicketRejected: boolean;
    declare readonly createdAt?: Date;
    declare readonly updatedAt?: Date;
}

NotificationSettings.init(
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
    notifyAssignedTicket: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'notify_assigned_ticket',
    },
    notifyReportedTicket: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'notify_reported_ticket_updated',
    },
    notifyTicketApproved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'notify_ticket_approved',
    },
    notifyTicketRejected: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'notify_ticket_rejected',
    },
  },
  {
    sequelize,
    tableName: 'notification_settings',
    timestamps: true,
  }
);