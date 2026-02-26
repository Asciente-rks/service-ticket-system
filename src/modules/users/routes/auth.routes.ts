import { Router } from 'express';
import { login } from '../controllers/login.controller';
import { validate } from '../../../middlewares/validator.middleware';
import { loginSchema } from '../../../utils/user.validation';

export const authRouter = Router();

authRouter.post('/login', validate(loginSchema), login);
