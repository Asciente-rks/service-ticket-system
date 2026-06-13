import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../config/db';

/**
 * A platform/version entry that belongs to a single Collection (project
 * space). Admins curate a list per collection — e.g. "Web · 1.1.0",
 * "Mobile · 128.80.2" — and members pick one when creating/updating a ticket
 * so issues are pinned to the exact build they were observed on.
 *
 * Scoped to both organization_id (tenant isolation) and collection_id
 * (each collection keeps its own list). The (collection_id, platform,
 * version) triple is unique so the same build can't be added twice.
 */
export interface PlatformVersionAttributes {
  id: string;
  organizationId: string;
  collectionId: string;
  platform: string;
  version: string;
  createdBy: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PlatformVersionCreationAttributes
  extends Optional<PlatformVersionAttributes, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'> {}

export class PlatformVersion
  extends Model<PlatformVersionAttributes, PlatformVersionCreationAttributes>
  implements PlatformVersionAttributes
{
  declare id: string;
  declare organizationId: string;
  declare collectionId: string;
  declare platform: string;
  declare version: string;
  declare createdBy: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

PlatformVersion.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    organizationId: { type: DataTypes.UUID, allowNull: false, field: 'organization_id' },
    collectionId: { type: DataTypes.UUID, allowNull: false, field: 'collection_id' },
    platform: { type: DataTypes.STRING(60), allowNull: false },
    version: { type: DataTypes.STRING(60), allowNull: false },
    createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    tableName: 'platform_versions',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['collection_id', 'platform', 'version'], name: 'uniq_platform_version' },
      { fields: ['collection_id'], name: 'idx_platform_versions_collection' },
      { fields: ['organization_id'], name: 'idx_platform_versions_org' },
    ],
  },
);
