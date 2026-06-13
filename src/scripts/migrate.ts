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

  // 7) tickets.jam_url — optional Jam (jam.dev) recording link on a ticket
  if (!(await columnExists('tickets', 'jam_url'))) {
    console.log('Adding column: tickets.jam_url');
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN jam_url TEXT NULL;`);
  } else {
    console.log('Column tickets.jam_url already exists — skipping.');
  }

  // 8) tickets.title -> TEXT (remove the legacy 255-char cap so titles can be
  //    any length). Safe/idempotent: widening VARCHAR to TEXT never truncates.
  console.log('Widening tickets.title to TEXT');
  try {
    await sequelize.query(`ALTER TABLE tickets MODIFY title TEXT NOT NULL;`);
  } catch (err: any) {
    console.warn('Could not modify tickets.title (may already be TEXT):', err.message);
  }

  // 9) ticket_comments — threaded comments on tickets (FK cascades on ticket delete)
  if (!(await tableExists('ticket_comments'))) {
    console.log('Creating table: ticket_comments');
    await sequelize.query(`
      CREATE TABLE ticket_comments (
        id CHAR(36) NOT NULL PRIMARY KEY,
        ticket_id CHAR(36) NOT NULL,
        organization_id CHAR(36) NULL,
        author_id CHAR(36) NOT NULL,
        parent_id CHAR(36) NULL,
        body TEXT NOT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX idx_ticket_comments_ticket (ticket_id),
        INDEX idx_ticket_comments_parent (parent_id),
        CONSTRAINT fk_ticket_comments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      );
    `);
  } else {
    console.log('Table ticket_comments already exists — skipping.');
  }

  // 10) ticket_events — immutable lifecycle timeline (FK cascades on ticket delete)
  if (!(await tableExists('ticket_events'))) {
    console.log('Creating table: ticket_events');
    await sequelize.query(`
      CREATE TABLE ticket_events (
        id CHAR(36) NOT NULL PRIMARY KEY,
        ticket_id CHAR(36) NOT NULL,
        organization_id CHAR(36) NULL,
        actor_id CHAR(36) NULL,
        type VARCHAR(48) NOT NULL,
        from_value VARCHAR(255) NULL,
        to_value VARCHAR(255) NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX idx_ticket_events_ticket (ticket_id),
        CONSTRAINT fk_ticket_events_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      );
    `);
  } else {
    console.log('Table ticket_events already exists — skipping.');
  }

  // 11) conversations — 1:1 direct-message threads (org-scoped)
  if (!(await tableExists('conversations'))) {
    console.log('Creating table: conversations');
    await sequelize.query(`
      CREATE TABLE conversations (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        user1_id CHAR(36) NOT NULL,
        user2_id CHAR(36) NOT NULL,
        last_message_at DATETIME NULL,
        last_message_text VARCHAR(300) NULL,
        last_message_sender_id CHAR(36) NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        UNIQUE KEY uniq_conversation_pair (organization_id, user1_id, user2_id),
        INDEX idx_conversations_user1 (user1_id),
        INDEX idx_conversations_user2 (user2_id)
      );
    `);
  } else {
    console.log('Table conversations already exists — skipping.');
  }

  // 12) messages — direct messages within a conversation
  if (!(await tableExists('messages'))) {
    console.log('Creating table: messages');
    await sequelize.query(`
      CREATE TABLE messages (
        id CHAR(36) NOT NULL PRIMARY KEY,
        conversation_id CHAR(36) NOT NULL,
        sender_id CHAR(36) NOT NULL,
        body TEXT NOT NULL,
        read_at DATETIME NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX idx_messages_conversation (conversation_id),
        CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
    `);
  } else {
    console.log('Table messages already exists — skipping.');
  }

  // 13) ai_conversations — per-user AI assistant chat threads (org-scoped)
  if (!(await tableExists('ai_conversations'))) {
    console.log('Creating table: ai_conversations');
    await sequelize.query(`
      CREATE TABLE ai_conversations (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL DEFAULT 'New chat',
        last_message_at DATETIME NULL,
        last_message_preview VARCHAR(300) NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX idx_ai_conversations_user (user_id),
        INDEX idx_ai_conversations_org (organization_id)
      );
    `);
  } else {
    console.log('Table ai_conversations already exists — skipping.');
  }

  // 14) ai_messages — messages within an AI conversation thread
  if (!(await tableExists('ai_messages'))) {
    console.log('Creating table: ai_messages');
    await sequelize.query(`
      CREATE TABLE ai_messages (
        id CHAR(36) NOT NULL PRIMARY KEY,
        conversation_id CHAR(36) NOT NULL,
        role VARCHAR(16) NOT NULL,
        body TEXT NOT NULL,
        ticket_refs TEXT NULL,
        meta TEXT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX idx_ai_messages_conversation (conversation_id),
        CONSTRAINT fk_ai_messages_conversation FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
      );
    `);
  } else {
    console.log('Table ai_messages already exists — skipping.');
  }

  // 15) collections — group tickets per system/product within an organization
  if (!(await tableExists('collections'))) {
    console.log('Creating table: collections');
    await sequelize.query(`
      CREATE TABLE collections (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        name VARCHAR(120) NOT NULL,
        description TEXT NULL,
        created_by CHAR(36) NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX idx_collections_org (organization_id)
      );
    `);
  } else {
    console.log('Table collections already exists — skipping.');
  }

  // 16) tickets.collection_id — which collection a ticket belongs to
  if (!(await columnExists('tickets', 'collection_id'))) {
    console.log('Adding column: tickets.collection_id');
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN collection_id CHAR(36) NULL;`);
    try {
      await sequelize.query(`CREATE INDEX idx_tickets_collection ON tickets (collection_id);`);
    } catch (err: any) {
      console.warn('Could not create idx_tickets_collection (may already exist):', err.message);
    }
  } else {
    console.log('Column tickets.collection_id already exists — skipping.');
  }

  // 17) ai_conversations.collection_id — AI chats are scoped per collection
  if (await tableExists('ai_conversations')) {
    if (!(await columnExists('ai_conversations', 'collection_id'))) {
      console.log('Adding column: ai_conversations.collection_id');
      await sequelize.query(`ALTER TABLE ai_conversations ADD COLUMN collection_id CHAR(36) NULL;`);
    } else {
      console.log('Column ai_conversations.collection_id already exists — skipping.');
    }
  }

  // 18) Purge orphaned notifications — rows pointing at tickets that were
  //     deleted before cascade cleanup existed. Safe one-time data fix.
  console.log('Purging orphaned notifications (linked ticket no longer exists)');
  try {
    const [result]: any = await sequelize.query(
      `DELETE FROM notifications
       WHERE ticket_id IS NOT NULL
         AND ticket_id NOT IN (SELECT id FROM tickets);`,
    );
    console.log('Orphaned notifications purged:', result?.affectedRows ?? 'done');
  } catch (err: any) {
    console.warn('Could not purge orphaned notifications:', err.message);
  }

  // 19) ticket_assignees — multiple assignees per ticket (the full set). The
  //     single tickets.assigned_to column remains the primary/lifecycle owner.
  if (!(await tableExists('ticket_assignees'))) {
    console.log('Creating table: ticket_assignees');
    await sequelize.query(`
      CREATE TABLE ticket_assignees (
        id CHAR(36) NOT NULL PRIMARY KEY,
        ticket_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        organization_id CHAR(36) NOT NULL,
        created_by CHAR(36) NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        UNIQUE KEY uniq_ticket_assignee (ticket_id, user_id),
        INDEX idx_ticket_assignees_user (user_id),
        INDEX idx_ticket_assignees_ticket (ticket_id),
        CONSTRAINT fk_ticket_assignees_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      );
    `);
  } else {
    console.log('Table ticket_assignees already exists — skipping.');
  }

  // 20) platform_versions — per-collection build catalog (e.g. "Web · 1.1.0").
  if (!(await tableExists('platform_versions'))) {
    console.log('Creating table: platform_versions');
    await sequelize.query(`
      CREATE TABLE platform_versions (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        collection_id CHAR(36) NOT NULL,
        platform VARCHAR(60) NOT NULL,
        version VARCHAR(60) NOT NULL,
        created_by CHAR(36) NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        UNIQUE KEY uniq_platform_version (collection_id, platform, version),
        INDEX idx_platform_versions_collection (collection_id),
        INDEX idx_platform_versions_org (organization_id)
      );
    `);
  } else {
    console.log('Table platform_versions already exists — skipping.');
  }

  // 21) tickets.platform_version_id — which build a ticket was observed on.
  if (!(await columnExists('tickets', 'platform_version_id'))) {
    console.log('Adding column: tickets.platform_version_id');
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN platform_version_id CHAR(36) NULL;`);
    try {
      await sequelize.query(`CREATE INDEX idx_tickets_platform_version ON tickets (platform_version_id);`);
    } catch (err: any) {
      console.warn('Could not create idx_tickets_platform_version (may already exist):', err.message);
    }
  } else {
    console.log('Column tickets.platform_version_id already exists — skipping.');
  }

  // 22) Backfill ticket_assignees from each ticket's existing single assignee,
  //     so historical assignments survive the move to a set. Idempotent.
  console.log('Backfilling ticket_assignees from tickets.assigned_to');
  try {
    await sequelize.query(`
      INSERT INTO ticket_assignees (id, ticket_id, user_id, organization_id, created_by, createdAt, updatedAt)
      SELECT UUID(), t.id, t.assigned_to, t.organization_id, NULL, NOW(), NOW()
      FROM tickets t
      WHERE t.assigned_to IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM ticket_assignees ta
          WHERE ta.ticket_id = t.id AND ta.user_id = t.assigned_to
        );
    `);
  } catch (err: any) {
    console.warn('Could not backfill ticket_assignees:', err.message);
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
