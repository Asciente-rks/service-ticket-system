import { Router } from 'express';
import { createUser } from '../controllers/create-user.controller';
import { listUsers } from '../controllers/list-users.controller';
import { getUser } from '../controllers/get-user.controller';
import { updateUser } from '../controllers/update-user.controller';
import { deleteUser } from '../controllers/delete-user.controller';
import { authenticateToken, requireOrganization } from '../../../middlewares/auth.middleware';
import { isAdmin, isOwnerOrAdmin, checkUserHierarchy, authorizeRoles } from '../../../middlewares/permissions.middleware';
import { notificationSettingsRouter } from './notification-settings.routes';
import { getRoles } from '../controllers/fetch-role.controller';
import { validate } from '../../../middlewares/validator.middleware';
import { ROLES } from '../../../config/roles';
import { createUserSchema,updateUserSchema,userIdParamsSchema} from '../../../utils/user.validation';

export const userRouter = Router();

// Public reference data (the global role lookup table).
userRouter.get('/roles', getRoles);

// Per-user notification preferences (requires auth + an organization).
userRouter.use('/notification-settings', authenticateToken, requireOrganization, notificationSettingsRouter);

userRouter.post('/', authenticateToken, requireOrganization, isAdmin, validate(createUserSchema), createUser);
userRouter.get('/', authenticateToken, requireOrganization, authorizeRoles([ROLES.ADMIN, ROLES.DEVELOPER, ROLES.TESTER]), listUsers);
userRouter.get('/:id', authenticateToken, requireOrganization, isOwnerOrAdmin, validate(userIdParamsSchema), getUser);
userRouter.put('/:id', authenticateToken, requireOrganization, isOwnerOrAdmin, checkUserHierarchy, validate(updateUserSchema), updateUser);
userRouter.delete('/:id', authenticateToken, requireOrganization, isOwnerOrAdmin, checkUserHierarchy, validate(userIdParamsSchema), deleteUser);
