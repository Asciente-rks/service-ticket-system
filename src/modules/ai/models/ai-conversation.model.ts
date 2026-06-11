import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../config/db';

/**
 * An AI assistant conversation thread. Each user can have many threads
 * (like ChatGPT-style multi-thread chat). Org-scoped for tenant isolation.
 */
export interface AiConversationAttributes {
  id: string;
  organizationId: string;
  userId: string;
  collectionId: string | null;
  title: string;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AiConversationCreationAttributes
  extends Optional<
    AiConversationAttributes,
    'id' | 'collectionId' | 'lastMessageAt' | 'lastMessagePreview' | 'createdAt' | 'updatedAt'
  > {}

export class AiConversation
  extends Model<AiConversationAttributes, AiConversationCreationAttributes>
  implements AiConversationAttributes
{
  declare id: string;
  declare organizationId: string;
  declare userId: string;
  declare collectionId: string | null;
  declare title: string;
  declare lastMessageAt: Date | null;
  declare lastMessagePreview: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

AiConversation.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false, field: 'organization_id' },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    collectionId: {
      // Which collection (project space) this chat belongs to. NULL = org-wide
      // chats (created with the collection scope cleared, or legacy threads).
      type: DataTypes.UUID,
      allowNull: true,
      field: 'collection_id',
    },
    title: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'New chat' },
    lastMessageAt: { type: DataTypes.DATE, allowNull: true, field: 'last_message_at' },
    lastMessagePreview: {
      type: DataTypes.STRING(300),
      allowNull: true,
      field: 'last_message_preview',
    },
  },
  { sequelize, tableName: 'ai_conversations', timestamps: true },
);
