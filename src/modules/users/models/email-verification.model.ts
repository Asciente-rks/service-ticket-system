import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../config/db';

/**
 * Stores email-ownership proof for the OTP registration flow.
 * The OTP itself is never stored in plaintext — only a bcrypt hash.
 */
export interface EmailVerificationAttributes {
  id: string;
  email: string;
  codeHash: string;
  purpose: string;
  verified: boolean;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EmailVerificationCreationAttributes
  extends Optional<
    EmailVerificationAttributes,
    'id' | 'purpose' | 'verified' | 'attempts' | 'consumedAt' | 'createdAt' | 'updatedAt'
  > {}

export class EmailVerification
  extends Model<EmailVerificationAttributes, EmailVerificationCreationAttributes>
  implements EmailVerificationAttributes
{
  declare id: string;
  declare email: string;
  declare codeHash: string;
  declare purpose: string;
  declare verified: boolean;
  declare attempts: number;
  declare expiresAt: Date;
  declare consumedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

EmailVerification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    codeHash: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'code_hash',
    },
    purpose: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'register',
    },
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
    consumedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'consumed_at',
    },
  },
  {
    sequelize,
    tableName: 'email_verifications',
    timestamps: true,
    indexes: [{ fields: ['email'] }],
  },
);
