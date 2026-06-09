import { Router } from 'express';
import { login, register, verifyOtp, setPassword, me } from '../controllers/auth.controller';
import { authenticateToken } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validator.middleware';
import { loginLimiter, registerLimiter } from '../../../middlewares/rate-limit.middleware';
import {
  loginSchema,
  registerSchema,
  verifyOtpSchema,
  setPasswordSchema,
} from '../../../utils/user.validation';

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate(loginSchema), login);

// OTP registration flow: register -> verify-otp -> set-password
authRouter.post('/register', registerLimiter, validate(registerSchema), register);
authRouter.post('/verify-otp', registerLimiter, validate(verifyOtpSchema), verifyOtp);
authRouter.post('/set-password', registerLimiter, validate(setPasswordSchema), setPassword);

authRouter.get('/me', authenticateToken, me);
