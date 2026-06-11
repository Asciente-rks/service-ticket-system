import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../config/db';

/**
 * A Collection groups tickets per system/product an organization tracks
 * (e.g. "Mobile App", "Billing Service"). Every ticket belongs to exactly
 * one collection; each collection has its own dashboard view.
 */
export interface CollectionAttributes {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CollectionCreationAttributes
  extends Optional<CollectionAttributes, 'id' | 'description' | 'createdBy' | 'createdAt' | 'updatedAt'> {}

export class Collection
  extends Model<CollectionAttributes, CollectionCreationAttributes>
  implements CollectionAttributes
{
  declare id: string;
  declare organizationId: string;
  declare name: string;
  declare description: string | null;
  declare createdBy: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Collection.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false, field: 'organization_id' },
    name: { type: DataTypes.STRING(120), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  },
  { sequelize, tableName: 'collections', timestamps: true },
);
