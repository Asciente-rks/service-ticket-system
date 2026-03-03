import { Response } from 'express';
import { AuthRequest } from '../../../middlewares/auth.middleware';
import * as userService from '../services/user.service';

export const getUser = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await userService.getUserById(id, req.user.roleId, req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        return res.status(500).json({ message: 'Error fetching user details' });
    }
};