import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/db';

/**
 * Lazily ensure the schema for the multi-assignee and platform/version
 * features exists. Mirrors the AI/collections bootstrap pattern: production is
 * migrated via a manual GitHub workflow, so these objects also self-provision
 * on first use after a code deploy. Idempotent; runs at most once per
 * process/warm Lambda container.
 *
 * Wired into the /tickets and /collections routers.
 */
let ensured = false;
let ensuring: Promise<void> | null = null;

const columnExists = async (table: string, column: string): Promise<boolean> => {
  const rows = await sequelize.query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column`,
    { replacements: { table, column }, type: QueryTypes.SELECT },
  );
  return Number(rows[0].c) > 0;
};

export const ensureTicketFeatureSchema = async (): Promise<void> => {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    // 1) ticket_assignees — full assignee set (the single tickets.assigned_to
    //    column stays as the primary/lifecycle owner).
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ticket_assignees (
        id CHAR(36) NOT NULL PRIMARY KEY,
        ticket_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        organization_id CHAR(36) NOT NULL,
        created_by CHAR(36) NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        UNIQUE KEY uniq_ticket_assignee (ticket_id, user_id),
        INDEX idx_ticket_assignees_user (user_id),
        INDEX idx_ticket_assignees_ticket (ticket_id)
      );
    `);

    // 2) platform_versions — per-collection build catalog.
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS platform_versions (
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

    // 3) tickets.platform_version_id — which build a ticket was observed on.
    if (!(await columnExists('tickets', 'platform_version_id'))) {
      await sequelize.query(`ALTER TABLE tickets ADD COLUMN platform_version_id CHAR(36) NULL;`);
      await sequelize
        .query(`CREATE INDEX idx_tickets_platform_version ON tickets (platform_version_id);`)
        .catch(() => {
          /* index may already exist */
        });
    }

    // 4) One-time backfill: mirror each ticket's existing single assignee into
    //    the new set so historical assignments survive and "assigned to me"
    //    counts stay accurate. Guarded by NOT EXISTS, so it's safe to re-run.
    await sequelize
      .query(`
        INSERT INTO ticket_assignees (id, ticket_id, user_id, organization_id, created_by, createdAt, updatedAt)
        SELECT UUID(), t.id, t.assigned_to, t.organization_id, NULL, NOW(), NOW()
        FROM tickets t
        WHERE t.assigned_to IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM ticket_assignees ta
            WHERE ta.ticket_id = t.id AND ta.user_id = t.assigned_to
          );
      `)
      .catch((err) => {
        // Non-fatal: the feature still works without the historical backfill.
        console.warn('[tickets] assignee backfill skipped:', err?.message || err);
      });

    ensured = true;
    console.log('[tickets] feature schema ensured (assignees + platform versions).');
  })().catch((err) => {
    ensuring = null; // allow retry on next request
    throw err;
  });

  return ensuring;
};
