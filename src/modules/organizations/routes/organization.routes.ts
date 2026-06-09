import { Router } from 'express';
import {
  createOrganization,
  joinOrganization,
  getMyOrganization,
} from '../controllers/organization.controller';
import { authenticateToken } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validator.middleware';
import {
  createOrganizationSchema,
  joinOrganizationSchema,
} from '../../../utils/user.validation';

export const organizationRouter = Router();

// These run after auth but intentionally do NOT require an existing org —
// they are the onboarding endpoints a brand-new user calls.
organizationRouter.post('/', authenticateToken, validate(createOrganizationSchema), createOrganization);
organizationRouter.post('/join', authenticateToken, validate(joinOrganizationSchema), joinOrganization);
organizationRouter.get('/me', authenticateToken, getMyOrganization);
