import { Response } from 'express';
import * as userService from '../services/user.service';
import { AuthRequest } from '../../../middlewares/auth.middleware';

export const listUsers = async(req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const users = await userService.getAllUsers(req.user.roleId);
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error listing users', error});
    }
}