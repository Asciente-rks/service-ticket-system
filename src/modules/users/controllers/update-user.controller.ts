import { Response } from 'express';
import * as userService from '../services/user.service';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { AuthRequest } from '../../../middlewares/auth.middleware';

export const updateUser = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
        const updatedUser = await userService.updateUser(req.params.id, req.body as UpdateUserDto, req.user.organizationId as string);
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(updatedUser);
    } catch (error) {
        res.status(500).json({ message: 'Error updating user', error });
    }
}
