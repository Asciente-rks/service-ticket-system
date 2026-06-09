import { Response } from 'express';
import * as userService from '../services/user.service';
import { AuthRequest } from '../../../middlewares/auth.middleware';

export const deleteUser = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
        const deleted = await userService.deleteUser(req.params.id, req.user.organizationId as string);
        if (!deleted) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: 'User deleted successfully'})
    } catch (error) {
        res.status(500).json({ message: 'Error deleting user', error });
    }
}
