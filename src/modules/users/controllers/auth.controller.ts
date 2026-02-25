import { Request, Response } from "express";
import * as authService from '../services/auth.service';
import { LoginDto } from "../dtos/login.dto";

export const login = async (req: Request, res: Response) => {
      const { email, password } = req.body as LoginDto;
      const { user, token } = await authService.login(email, password);
      if (!user || !token) {
        return res.status(401).json({ message: "Invalid email or password" });
      }    
      res.status(200).json({ user, token });
}
