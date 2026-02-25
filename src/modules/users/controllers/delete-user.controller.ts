import { Request, Response } from 'express';
import * as userService from '../services/user.service';

export const deleteUser = async (req: Request, res: Response) => {
    try {
        const deleted = await userService.deleteUser(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: 'User deleted successfully'})
    } catch (error) {
        res.status(500).json({ message: 'Error deleting user', error });
    }
}