import { Router } from 'express';
import { createUser } from '../controllers/create-user.controller';
import { listUsers } from '../controllers/list-users.controller';
import { getUser } from '../controllers/get-user.controller';
import { updateUser } from '../controllers/update-user.controller';
import { deleteUser } from '../controllers/delete-user.controller';
import { authenticateToken } from '../../../middlewares/auth.middleware';
import { isAdmin, isOwnerOrAdmin } from '../../../middlewares/permissions.middleware';
import { getNotificationSettings } from '../controllers/get-notification-settings.controller';
import { updateNotificationSettings } from '../controllers/update-notification-settings.controller';

export const userRouter = Router();

userRouter.post('/', authenticateToken, isAdmin, createUser);
userRouter.get('/', authenticateToken, isAdmin, listUsers);
userRouter.get('/notification-settings', authenticateToken, getNotificationSettings);
userRouter.patch('/notification-settings', authenticateToken, updateNotificationSettings);
userRouter.get('/:id', authenticateToken, isOwnerOrAdmin, getUser);
userRouter.put('/:id', authenticateToken, isOwnerOrAdmin, updateUser);
userRouter.delete('/:id', authenticateToken, isAdmin, deleteUser);