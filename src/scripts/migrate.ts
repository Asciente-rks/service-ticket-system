import { QueryTypes } from 'sequelize';
import { sequelize, connectDB } from '../config/db';

/**
 * Idempotent, additive schema migration for the multi-tenant upgrade.
 *
 * Hand-written (rather than sequelize.sync({ alter: true })) so it is safe to
 * run against a live database: it only CREATEs tables / ADDs columns that are
 * missing, and relaxes users.role_id to nullable. Run via `npm run db:migrate`
 * or the GitHub "Database (migrate/seed)" workflow.
 */

const tableExists = async (table: string): Promise<boolean> => {
  const rows = await sequelize.query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = :table`,
    { replacements: { table }, type: QueryTypes.SELECT },
  );
  return Number(rows[0].c) > 0;
};

const columnExists = async (table: string, column: string): Promise<boolean> => {
  const rows = await sequelize.query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column`,
    { replacements: { table, column }, type: QueryTypes.SELECT },
  );
  return Number(rows[0].c) > 0;
};

const run = async () => {
  await connectDB();
  console.log('--- Running multi-tenant schema migration ---');

  // 1) organizations
  if (!(await tableExists('organizations'))) {
    console.log('Creating table: organizations');
    await sequelize.query(`
      CREATE TABLE organizations (
        id CHAR(36) NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        invite_code VARCHAR(255) NOT NULL UNIQUE,
        owner_id CHAR(36) NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL
      );
    `);
  } else {
    console.log('Table organizations already exists — skipping.');
  }

  // 2) email_verifications
  if (!(await tableExists('email_verifications'))) {
    console.log('Creating table: email_verifications');
    await sequelize.query(`
      CREATE TABLE email_verifications (
        id CHAR(36) NOT NULL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        purpose VARCHAR(64) NOT NULL DEFAULT 'register',
        verified TINYINT(1) NOT NULL DEFAULT 0,
        attempts INT NOT NULL DEFAULT 0,
        expires_at DATETIME NOT NULL,
        consumed_at DATETIME NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX idx_email_verifications_email (email)
      );
    `);
  } else {
    console.log('Table email_verifications already exists — skipping.');
  }

  // 3) users.organization_id
  if (!(await columnExists('users', 'organization_id'))) {
    console.log('Adding column: users.organization_id');
    await sequelize.query(`ALTER TABLE users ADD COLUMN organization_id CHAR(36) NULL;`);
  } else {
    console.log('Column users.organization_id already exists — skipping.');
  }

  // 4) users.role_id -> nullable (users have no role until they join/create an org)
  console.log('Relaxing users.role_id to nullable');
  try {
    await sequelize.query(`ALTER TABLE users MODIFY role_id CHAR(36) NULL;`);
  } catch (err: any) {
    console.warn('Could not modify users.role_id (may already be nullable):', err.message);
  }

  // 5) tickets.organization_id
  if (!(await columnExists('tickets', 'organization_id'))) {
    console.log('Adding column: tickets.organization_id');
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN organization_id CHAR(36) NULL;`);
  } else {
    console.log('Column tickets.organization_id already exists — skipping.');
  }

  // 6) notifications.organization_id
  if (!(await columnExists('notifications', 'organization_id'))) {
    console.log('Adding column: notifications.organization_id');
    await sequelize.query(`ALTER TABLE notifications ADD COLUMN organization_id CHAR(36) NULL;`);
  } else {
    console.log('Column notifications.organization_id already exists — skipping.');
  }

  console.log('--- Migration complete ---');
  await sequelize.close();
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
