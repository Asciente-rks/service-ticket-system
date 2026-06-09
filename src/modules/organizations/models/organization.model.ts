import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../config/db';

export interface OrganizationAttributes {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  ownerId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrganizationCreationAttributes
  extends Optional<OrganizationAttributes, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'> {}

export class Organization
  extends Model<OrganizationAttributes, OrganizationCreationAttributes>
  implements OrganizationAttributes
{
  declare id: string;
  declare name: string;
  declare slug: string;
  declare inviteCode: string;
  declare ownerId: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Organization.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    inviteCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'invite_code',
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'owner_id',
    },
  },
  {
    sequelize,
    tableName: 'organizations',
    timestamps: true,
  },
);
