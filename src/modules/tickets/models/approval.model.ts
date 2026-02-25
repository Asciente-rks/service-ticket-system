import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../config/db';

export interface ApprovalAttributes {
    id: string;
    ticketId: string;
    approverId: string;
    status: 'Approved' | 'Rejected';
    comment?: string;
    approvedAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ApprovalCreationAttributes extends Omit<ApprovalAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class Approval extends Model<ApprovalAttributes, ApprovalCreationAttributes> implements ApprovalAttributes {
    declare id: string;
    declare ticketId: string;
    declare approverId: string;
    declare status: 'Approved' | 'Rejected';
    declare comment: string;
    declare approvedAt: Date;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

Approval.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
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
    approverId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'approver_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('Approved', 'Rejected'),
      allowNull: false,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'approved_at',
    },
  },
  {
    sequelize,
    tableName: 'approvals',
    timestamps: true,
  }
);