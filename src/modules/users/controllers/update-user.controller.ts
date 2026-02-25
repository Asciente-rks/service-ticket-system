import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { UserResponseDto } from '../dtos/user-response.dto';

export const updateUser = async (req: Request, res: Response) => {
    try {
        const updatedUser = await userService.updateUser(req.params.id, req.body as UpdateUserDto);
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }        
        res.status(200).json(updatedUser);
    } catch (error) {
        res.status(500).json({ message: 'Error updating user', error });
    }
}
