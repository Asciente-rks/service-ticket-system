import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../config/db';

/**
 * A single message within an AI conversation thread.
 * role: 'user' | 'assistant'
 * ticketRefs: JSON array of { id, title, status?, priority? } the assistant
 * referenced — the frontend renders these as clickable ticket chips.
 * meta: JSON describing which provider/model produced an assistant reply.
 */
export interface AiMessageAttributes {
  id: string;
  conversationId: string;
  role: string;
  body: string;
  ticketRefs: string | null;
  meta: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AiMessageCreationAttributes
  extends Optional<AiMessageAttributes, 'id' | 'ticketRefs' | 'meta' | 'createdAt' | 'updatedAt'> {}

export class AiMessage
  extends Model<AiMessageAttributes, AiMessageCreationAttributes>
  implements AiMessageAttributes
{
  declare id: string;
  declare conversationId: string;
  declare role: string;
  declare body: string;
  declare ticketRefs: string | null;
  declare meta: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

AiMessage.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    conversationId: { type: DataTypes.UUID, allowNull: false, field: 'conversation_id' },
    role: { type: DataTypes.STRING(16), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    ticketRefs: { type: DataTypes.TEXT, allowNull: true, field: 'ticket_refs' },
    meta: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, tableName: 'ai_messages', timestamps: true },
);
