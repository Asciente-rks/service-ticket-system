import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../config/db';

export interface UserAttributes {
  id: string;
  roleId: string | null;
  organizationId: string | null;
  name: string;
  email: string;
  password: string;
  createdAt?: Date;
  updatedAt?: Date;

}

export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'roleId' | 'organizationId' | 'createdAt' | 'updatedAt'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string;
  declare roleId: string | null;
  declare organizationId: string | null;
  declare name: string;
  declare email: string;
  declare password: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    roleId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'role_id',
      references: {
        model: 'roles',
        key: 'id',
      },
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'organization_id',
      references: {
        model: 'organizations',
        key: 'id',
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
  }
);