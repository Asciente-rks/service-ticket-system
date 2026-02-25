import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { UserResponseDto } from '../dtos/user-response.dto';

export const getUser = async (req: Request, res: Response) => {
    try {
        const user = await userService.getUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user as UserResponseDto);
    } catch (error) {
        res.status(500).json({ message: 'Error getting user', error });
    }
}
