import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UserResponseDto } from '../dtos/user-response.dto';
import { UniqueConstraintError, ValidationError } from 'sequelize';

export const createUser = async (req: Request, res: Response) => {
  try {
    const user = await userService.createUser(req.body as CreateUserDto);
    res.status(201).json(user as UserResponseDto);
  } catch (error: any) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.errors.map((e: any) => e.message).join(', ') });
    }
    res.status(500).json({ message: 'Error creating user', error: error.message || 'Internal Server Error' });
  }
};