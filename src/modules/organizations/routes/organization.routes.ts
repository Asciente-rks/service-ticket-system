import { Router } from 'express';
import {
  createOrganization,
  joinOrganization,
  getMyOrganization,
  updateOrganization,
  regenerateInviteCode,
  deleteOrganization,
} from '../controllers/organization.controller';
import { authenticateToken, requireOrganization } from '../../../middlewares/auth.middleware';
import { isAdmin } from '../../../middlewares/permissions.middleware';
import { validate } from '../../../middlewares/validator.middleware';
import {
  createOrganizationSchema,
  joinOrganizationSchema,
  updateOrganizationSchema,
} from '../../../utils/user.validation';

export const organizationRouter = Router();

// These run after auth but intentionally do NOT require an existing org —
// they are the onboarding endpoints a brand-new user calls.
organizationRouter.post('/', authenticateToken, validate(createOrganizationSchema), createOrganization);
organizationRouter.post('/join', authenticateToken, validate(joinOrganizationSchema), joinOrganization);
organizationRouter.get('/me', authenticateToken, getMyOrganization);

// Organization management (Admin/SuperAdmin). Delete is further restricted to
// the owner inside the service layer.
organizationRouter.patch('/me', authenticateToken, requireOrganization, isAdmin, validate(updateOrganizationSchema), updateOrganization);
organizationRouter.post('/me/invite-code', authenticateToken, requireOrganization, isAdmin, regenerateInviteCode);
organizationRouter.delete('/me', authenticateToken, requireOrganization, isAdmin, deleteOrganization);
