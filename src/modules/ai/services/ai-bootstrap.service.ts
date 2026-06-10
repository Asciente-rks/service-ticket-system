import { sequelize } from '../../../config/db';

/**
 * Lazily ensure the AI tables exist. The production DB is migrated via a
 * manually-triggered GitHub workflow, so to make the AI feature work
 * immediately after a code deploy we also create the two tables on first use
 * (idempotent CREATE TABLE IF NOT EXISTS — safe on TiDB/MySQL).
 * Runs at most once per process/warm Lambda container.
 */
let ensured = false;
let ensuring: Promise<void> | null = null;

export const ensureAiTables = async (): Promise<void> => {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ai_conversations (
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
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ai_messages (
        id CHAR(36) NOT NULL PRIMARY KEY,
        conversation_id CHAR(36) NOT NULL,
        role VARCHAR(16) NOT NULL,
        body TEXT NOT NULL,
        ticket_refs TEXT NULL,
        meta TEXT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX idx_ai_messages_conversation (conversation_id)
      );
    `);
    ensured = true;
    console.log('[ai] AI tables ensured.');
  })().catch((err) => {
    ensuring = null; // allow retry on next request
    throw err;
  });

  return ensuring;
};
