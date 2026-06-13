import { Router, Request, Response, NextFunction } from 'express';
import {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from '../controllers/collection.controller';
import { authenticateToken, requireOrganization } from '../../../middlewares/auth.middleware';
import { authorizeRoles } from '../../../middlewares/permissions.middleware';
import { validate } from '../../../middlewares/validator.middleware';
import { ROLES } from '../../../config/roles';
import {
  createCollectionSchema,
  updateCollectionSchema,
  collectionIdParamsSchema,
} from '../../../utils/collection.validation';
import { ensureCollectionSchema } from '../services/collection-bootstrap.service';
import { ensureTicketFeatureSchema } from '../../tickets/services/ticket-features-bootstrap.service';
import { platformVersionRouter } from './platform-version.routes';

export const collectionRouter = Router();

// All collection endpoints are authenticated and tenant-scoped.
collectionRouter.use(authenticateToken, requireOrganization);

// Self-provision the collections + feature schema on first use (no-op afterwards).
collectionRouter.use((req: Request, res: Response, next: NextFunction) => {
  ensureCollectionSchema()
    .then(() => ensureTicketFeatureSchema())
    .then(() => next())
    .catch((err) => {
      console.error('[collections] failed to ensure schema:', err);
      res.status(500).json({ message: 'Collections storage is not available right now.' });
    });
});

// Every org member can browse collections; only Admins/SuperAdmins manage them.
collectionRouter.get('/', listCollections);
collectionRouter.post('/', authorizeRoles([ROLES.ADMIN]), validate(createCollectionSchema), createCollection);
collectionRouter.patch('/:id', authorizeRoles([ROLES.ADMIN]), validate(updateCollectionSchema), updateCollection);
collectionRouter.delete('/:id', authorizeRoles([ROLES.ADMIN]), validate(collectionIdParamsSchema), deleteCollection);

// Per-collection platform/version catalog (e.g. "Web · 1.1.0").
collectionRouter.use('/:collectionId/platform-versions', platformVersionRouter);
