import { Router } from 'express';
import {
  listPlatformVersions,
  createPlatformVersion,
  updatePlatformVersion,
  deletePlatformVersion,
} from '../controllers/platform-version.controller';
import { authorizeRoles } from '../../../middlewares/permissions.middleware';
import { validate } from '../../../middlewares/validator.middleware';
import { ROLES } from '../../../config/roles';
import {
  collectionIdParamSchema,
  createPlatformVersionSchema,
  updatePlatformVersionSchema,
  platformVersionIdParamsSchema,
} from '../../../utils/platform-version.validation';

// mergeParams: true so :collectionId from the parent collection router is available.
export const platformVersionRouter = Router({ mergeParams: true });

// Any org member can read a collection's platform/version list (needed for the
// ticket create/edit dropdown). Only Admins/SuperAdmins manage the list.
platformVersionRouter.get('/', validate(collectionIdParamSchema), listPlatformVersions);
platformVersionRouter.post('/', authorizeRoles([ROLES.ADMIN]), validate(createPlatformVersionSchema), createPlatformVersion);
platformVersionRouter.patch('/:id', authorizeRoles([ROLES.ADMIN]), validate(updatePlatformVersionSchema), updatePlatformVersion);
platformVersionRouter.delete('/:id', authorizeRoles([ROLES.ADMIN]), validate(platformVersionIdParamsSchema), deletePlatformVersion);
