import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { UserResponseDto } from '../dtos/user-response.dto';

export const listUsers = async(req: Request, res: Response) => {
    try {
        const users = await userService.getAllUsers()
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error listing users', error});
    }
}