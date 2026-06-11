import { Op } from 'sequelize';
import { Collection } from '../models/collection.model';
import { Ticket } from '../../tickets/models/ticket.model';
import { STATUSES } from '../../../config/statuses';

export interface CollectionDto {
  id: string;
  name: string;
  description: string | null;
  ticketCount: number;
  openCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CLOSED_STATUS_IDS = [STATUSES.RESOLVED, STATUSES.CLOSED].map((s) => s.toLowerCase());

const toDto = (c: Collection, ticketCount = 0, openCount = 0): CollectionDto => ({
  id: c.id,
  name: c.name,
  description: c.description,
  ticketCount,
  openCount,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

/**
 * The org's default collection = its oldest one. Created as "General" when
 * the org has none yet (first run after the feature ships). Tickets that
 * pre-date the feature (collection_id NULL) are adopted into it.
 */
export const getDefaultCollection = async (
  organizationId: string,
  createdBy: string | null = null,
): Promise<Collection> => {
  let collection = await Collection.findOne({
    where: { organizationId },
    order: [['createdAt', 'ASC']],
  });
  if (!collection) {
    collection = await Collection.create({
      organizationId,
      name: 'General',
      description: 'Default collection for this organization.',
      createdBy,
    });
  }
  return collection;
};

/** Assign any orphaned tickets (NULL collection) to the org's default collection. */
const adoptOrphanTickets = async (organizationId: string, defaultCollectionId: string) => {
  await Ticket.update(
    { collectionId: defaultCollectionId } as any,
    { where: { organizationId, collectionId: null as any } },
  );
};

export const listCollections = async (
  organizationId: string,
  userId: string,
): Promise<CollectionDto[]> => {
  const defaultCollection = await getDefaultCollection(organizationId, userId);
  await adoptOrphanTickets(organizationId, defaultCollection.id);

  const [collections, tickets] = await Promise.all([
    Collection.findAll({ where: { organizationId }, order: [['createdAt', 'ASC']] }),
    Ticket.findAll({ where: { organizationId }, attributes: ['collectionId', 'statusId'] }),
  ]);

  const counts = new Map<string, { total: number; open: number }>();
  for (const t of tickets as any[]) {
    const key = String(t.collectionId || '');
    const entry = counts.get(key) || { total: 0, open: 0 };
    entry.total += 1;
    if (!CLOSED_STATUS_IDS.includes(String(t.statusId || '').toLowerCase())) entry.open += 1;
    counts.set(key, entry);
  }

  return collections.map((c) => {
    const entry = counts.get(String(c.id)) || { total: 0, open: 0 };
    return toDto(c, entry.total, entry.open);
  });
};

const assertNameAvailable = async (
  organizationId: string,
  name: string,
  excludeId?: string,
) => {
  const where: any = { organizationId, name: { [Op.like]: name } };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const existing = await Collection.findOne({ where });
  if (existing) {
    const err: any = new Error(`A collection named "${name}" already exists.`);
    err.statusCode = 409;
    throw err;
  }
};

export const createCollection = async (
  organizationId: string,
  userId: string,
  data: { name: string; description?: string | null },
): Promise<CollectionDto> => {
  const name = data.name.trim();
  await assertNameAvailable(organizationId, name);
  const collection = await Collection.create({
    organizationId,
    name,
    description: data.description?.trim() || null,
    createdBy: userId,
  });
  return toDto(collection, 0, 0);
};

const findOwned = async (organizationId: string, id: string): Promise<Collection> => {
  const collection = await Collection.findByPk(id);
  if (!collection || String(collection.organizationId) !== String(organizationId)) {
    const err: any = new Error('Collection not found.');
    err.statusCode = 404;
    throw err;
  }
  return collection;
};

export const updateCollection = async (
  organizationId: string,
  id: string,
  data: { name?: string; description?: string | null },
): Promise<CollectionDto> => {
  const collection = await findOwned(organizationId, id);
  if (data.name !== undefined) {
    const name = data.name.trim();
    await assertNameAvailable(organizationId, name, id);
    collection.name = name;
  }
  if (data.description !== undefined) {
    collection.description = data.description?.trim() || null;
  }
  await collection.save();
  const ticketCount = await Ticket.count({ where: { organizationId, collectionId: id } });
  return toDto(collection, ticketCount, 0);
};

/**
 * Delete a collection. The last collection of an org cannot be deleted
 * (every ticket must live somewhere). Its tickets move to the default
 * (oldest remaining) collection.
 */
export const deleteCollection = async (
  organizationId: string,
  id: string,
): Promise<{ movedTo: { id: string; name: string } | null }> => {
  const collection = await findOwned(organizationId, id);

  const total = await Collection.count({ where: { organizationId } });
  if (total <= 1) {
    const err: any = new Error(
      'You need at least one collection. Create another collection before deleting this one.',
    );
    err.statusCode = 400;
    throw err;
  }

  const fallback = await Collection.findOne({
    where: { organizationId, id: { [Op.ne]: id } },
    order: [['createdAt', 'ASC']],
  });

  let movedTo: { id: string; name: string } | null = null;
  if (fallback) {
    const [moved] = await Ticket.update(
      { collectionId: fallback.id } as any,
      { where: { organizationId, collectionId: id } },
    );
    if (moved > 0) movedTo = { id: fallback.id, name: fallback.name };
  }

  await collection.destroy();
  return { movedTo };
};

/** Validate a collection belongs to the org (for ticket create/move). */
export const assertCollectionInOrg = async (
  organizationId: string,
  collectionId: string,
): Promise<Collection> => {
  const collection = await Collection.findByPk(collectionId);
  if (!collection || String(collection.organizationId) !== String(organizationId)) {
    const err: any = new Error('Collection not found in your organization.');
    err.statusCode = 400;
    throw err;
  }
  return collection;
};
