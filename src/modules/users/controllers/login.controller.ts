import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { LoginDto } from "../dtos/login.dto";
import { UserResponseDto } from "../dtos/user-response.dto";

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginDto;
    const { user, token } = await authService.login(email, password);
    if (!user || !token) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    res.status(200).json({ user: user as UserResponseDto, token });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in' });
  }
};
