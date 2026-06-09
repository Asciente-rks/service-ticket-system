import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../config/db';

export interface CommentAttributes {
  id: string;
  ticketId: string;
  organizationId: string | null;
  authorId: string;
  parentId: string | null;
  body: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CommentCreationAttributes
  extends Optional<CommentAttributes, 'id' | 'parentId' | 'organizationId' | 'createdAt' | 'updatedAt'> {}

export class Comment extends Model<CommentAttributes, CommentCreationAttributes> implements CommentAttributes {
  declare id: string;
  declare ticketId: string;
  declare organizationId: string | null;
  declare authorId: string;
  declare parentId: string | null;
  declare body: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Comment.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    ticketId: { type: DataTypes.UUID, allowNull: false, field: 'ticket_id' },
    organizationId: { type: DataTypes.UUID, allowNull: true, field: 'organization_id' },
    authorId: { type: DataTypes.UUID, allowNull: false, field: 'author_id' },
    parentId: { type: DataTypes.UUID, allowNull: true, field: 'parent_id' },
    body: { type: DataTypes.TEXT, allowNull: false },
  },
  { sequelize, tableName: 'ticket_comments', timestamps: true },
);
