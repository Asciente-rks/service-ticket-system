import { Op } from 'sequelize';
import { PlatformVersion } from '../models/platform-version.model';
import { Ticket } from '../../tickets/models/ticket.model';
import { assertCollectionInOrg } from './collection.service';

export interface PlatformVersionDto {
  id: string;
  collectionId: string;
  platform: string;
  version: string;
  label: string;
  createdAt: Date;
  updatedAt: Date;
}

const toDto = (pv: PlatformVersion): PlatformVersionDto => ({
  id: pv.id,
  collectionId: pv.collectionId,
  platform: pv.platform,
  version: pv.version,
  label: `${pv.platform} · ${pv.version}`,
  createdAt: pv.createdAt,
  updatedAt: pv.updatedAt,
});

/** List a collection's platform/version entries (org + collection scoped). */
export const listPlatformVersions = async (
  organizationId: string,
  collectionId: string,
): Promise<PlatformVersionDto[]> => {
  await assertCollectionInOrg(organizationId, collectionId);
  const rows = await PlatformVersion.findAll({
    where: { organizationId, collectionId },
    order: [
      ['platform', 'ASC'],
      ['version', 'ASC'],
    ],
  });
  return rows.map(toDto);
};

const assertUnique = async (
  collectionId: string,
  platform: string,
  version: string,
  excludeId?: string,
) => {
  const where: any = { collectionId, platform: { [Op.like]: platform }, version: { [Op.like]: version } };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const existing = await PlatformVersion.findOne({ where });
  if (existing) {
    const err: any = new Error(`"${platform} · ${version}" already exists in this collection.`);
    err.statusCode = 409;
    throw err;
  }
};

export const createPlatformVersion = async (
  organizationId: string,
  collectionId: string,
  userId: string,
  data: { platform: string; version: string },
): Promise<PlatformVersionDto> => {
  await assertCollectionInOrg(organizationId, collectionId);
  const platform = data.platform.trim();
  const version = data.version.trim();
  await assertUnique(collectionId, platform, version);
  const created = await PlatformVersion.create({
    organizationId,
    collectionId,
    platform,
    version,
    createdBy: userId,
  });
  return toDto(created);
};

const findOwned = async (
  organizationId: string,
  collectionId: string,
  id: string,
): Promise<PlatformVersion> => {
  const pv = await PlatformVersion.findByPk(id);
  if (
    !pv ||
    String(pv.organizationId) !== String(organizationId) ||
    String(pv.collectionId) !== String(collectionId)
  ) {
    const err: any = new Error('Platform/version not found.');
    err.statusCode = 404;
    throw err;
  }
  return pv;
};

export const updatePlatformVersion = async (
  organizationId: string,
  collectionId: string,
  id: string,
  data: { platform?: string; version?: string },
): Promise<PlatformVersionDto> => {
  const pv = await findOwned(organizationId, collectionId, id);
  const platform = data.platform !== undefined ? data.platform.trim() : pv.platform;
  const version = data.version !== undefined ? data.version.trim() : pv.version;
  await assertUnique(collectionId, platform, version, id);
  pv.platform = platform;
  pv.version = version;
  await pv.save();
  return toDto(pv);
};

/**
 * Delete a platform/version. Any tickets pinned to it are detached (set to
 * NULL) first so no ticket references a deleted build.
 */
export const deletePlatformVersion = async (
  organizationId: string,
  collectionId: string,
  id: string,
): Promise<void> => {
  const pv = await findOwned(organizationId, collectionId, id);
  await Ticket.update(
    { platformVersionId: null } as any,
    { where: { organizationId, platformVersionId: id } },
  );
  await pv.destroy();
};
