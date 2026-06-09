import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../config/db';

/**
 * A 1:1 direct-message conversation within an organization. The two participant
 * ids are stored sorted (user1Id < user2Id) so a pair maps to exactly one row.
 */
export interface ConversationAttributes {
  id: string;
  organizationId: string;
  user1Id: string;
  user2Id: string;
  lastMessageAt: Date | null;
  lastMessageText: string | null;
  lastMessageSenderId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ConversationCreationAttributes
  extends Optional<ConversationAttributes, 'id' | 'lastMessageAt' | 'lastMessageText' | 'lastMessageSenderId' | 'createdAt' | 'updatedAt'> {}

export class Conversation extends Model<ConversationAttributes, ConversationCreationAttributes> implements ConversationAttributes {
  declare id: string;
  declare organizationId: string;
  declare user1Id: string;
  declare user2Id: string;
  declare lastMessageAt: Date | null;
  declare lastMessageText: string | null;
  declare lastMessageSenderId: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Conversation.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false, field: 'organization_id' },
    user1Id: { type: DataTypes.UUID, allowNull: false, field: 'user1_id' },
    user2Id: { type: DataTypes.UUID, allowNull: false, field: 'user2_id' },
    lastMessageAt: { type: DataTypes.DATE, allowNull: true, field: 'last_message_at' },
    lastMessageText: { type: DataTypes.STRING(300), allowNull: true, field: 'last_message_text' },
    lastMessageSenderId: { type: DataTypes.UUID, allowNull: true, field: 'last_message_sender_id' },
  },
  { sequelize, tableName: 'conversations', timestamps: true },
);
