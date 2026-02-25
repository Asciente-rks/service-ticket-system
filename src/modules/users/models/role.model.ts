import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../config/db';

export interface RoleAttributes {
  id: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RoleCreationAttributes extends Omit<RoleAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class Role extends Model<RoleAttributes, RoleCreationAttributes> implements RoleAttributes {
  declare id: string;
  declare name: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Role.init(
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
    tableName: 'roles',
    timestamps: true
  }
);
