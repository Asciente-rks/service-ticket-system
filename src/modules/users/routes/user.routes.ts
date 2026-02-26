import { Router } from 'express';
import { createUser } from '../controllers/create-user.controller';
import { listUsers } from '../controllers/list-users.controller';
import { getUser } from '../controllers/get-user.controller';
import { updateUser } from '../controllers/update-user.controller';
import { deleteUser } from '../controllers/delete-user.controller';
import { authenticateToken } from '../../../middlewares/auth.middleware';
import { isAdmin, isOwnerOrAdmin, checkUserHierarchy } from '../../../middlewares/permissions.middleware';
import { notificationSettingsRouter } from './notification-settings.routes';

import { validate } from '../../../middlewares/validator.middleware';
import {
    createUserSchema,
    updateUserSchema,
    userIdParamsSchema
} from '../../../utils/user.validation';

export const userRouter = Router();

// Mount specific sub-routers before generic/parameterized routes.
userRouter.use('/notification-settings', authenticateToken, notificationSettingsRouter);

userRouter.post('/', authenticateToken, isAdmin, validate(createUserSchema), createUser);
userRouter.get('/', authenticateToken, isAdmin, listUsers);
userRouter.get('/:id', authenticateToken, isOwnerOrAdmin, validate(userIdParamsSchema), getUser);
userRouter.put('/:id', authenticateToken, isOwnerOrAdmin, checkUserHierarchy, validate(updateUserSchema), updateUser);
userRouter.delete('/:id', authenticateToken, isOwnerOrAdmin, checkUserHierarchy, validate(userIdParamsSchema), deleteUser);