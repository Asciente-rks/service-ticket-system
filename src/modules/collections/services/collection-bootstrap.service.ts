import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/db';

/**
 * Lazily ensure the collections schema exists (collections table +
 * tickets.collection_id column). Mirrors the AI-tables pattern: the
 * production DB is migrated via a manual GitHub workflow, so the feature
 * must self-provision on first use after a code deploy. Idempotent; runs
 * at most once per process/warm Lambda container.
 *
 * Wired into BOTH the /collections and /tickets routers — ticket queries
 * include the collection association, so the column must exist before any
 * ticket endpoint runs.
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

export const ensureCollectionSchema = async (): Promise<void> => {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS collections (
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
    if (!(await columnExists('tickets', 'collection_id'))) {
      await sequelize.query(`ALTER TABLE tickets ADD COLUMN collection_id CHAR(36) NULL;`);
      await sequelize.query(`CREATE INDEX idx_tickets_collection ON tickets (collection_id);`).catch(() => {
        /* index may already exist */
      });
    }
    ensured = true;
    console.log('[collections] schema ensured.');
  })().catch((err) => {
    ensuring = null; // allow retry on next request
    throw err;
  });

  return ensuring;
};
