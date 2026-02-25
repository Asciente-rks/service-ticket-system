import { Router } from 'express';
import { login } from '../controllers/login.controller';

export const authRouter = Router();

authRouter.post('/login', login);
