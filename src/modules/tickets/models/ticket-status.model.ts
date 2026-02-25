import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../config/db';

export interface TicketStatusAttributes {
  id: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TicketStatusCreationAttributes extends Omit<TicketStatusAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class TicketStatus extends Model<TicketStatusAttributes, TicketStatusCreationAttributes> implements TicketStatusAttributes {
  declare id: string;
  declare name: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TicketStatus.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
    },
    {
      sequelize,
      tableName: 'ticket_status',
      timestamps: true
    }
  );