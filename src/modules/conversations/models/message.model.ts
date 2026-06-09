import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../config/db';

export interface MessageAttributes {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MessageCreationAttributes
  extends Optional<MessageAttributes, 'id' | 'readAt' | 'createdAt' | 'updatedAt'> {}

export class Message extends Model<MessageAttributes, MessageCreationAttributes> implements MessageAttributes {
  declare id: string;
  declare conversationId: string;
  declare senderId: string;
  declare body: string;
  declare readAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Message.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    conversationId: { type: DataTypes.UUID, allowNull: false, field: 'conversation_id' },
    senderId: { type: DataTypes.UUID, allowNull: false, field: 'sender_id' },
    body: { type: DataTypes.TEXT, allowNull: false },
    readAt: { type: DataTypes.DATE, allowNull: true, field: 'read_at' },
  },
  { sequelize, tableName: 'messages', timestamps: true },
);
