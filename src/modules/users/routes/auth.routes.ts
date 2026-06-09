import { Router } from 'express';
import {
  login,
  register,
  verifyOtp,
  setPassword,
  me,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  changePassword,
} from '../controllers/auth.controller';
import { authenticateToken } from '../../../middlewares/auth.middleware';
import { validate } from '../../../middlewares/validator.middleware';
import { loginLimiter, registerLimiter } from '../../../middlewares/rate-limit.middleware';
import {
  loginSchema,
  registerSchema,
  verifyOtpSchema,
  setPasswordSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../../../utils/user.validation';

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate(loginSchema), login);

// OTP registration flow: register -> verify-otp -> set-password
authRouter.post('/register', registerLimiter, validate(registerSchema), register);
authRouter.post('/verify-otp', registerLimiter, validate(verifyOtpSchema), verifyOtp);
authRouter.post('/set-password', registerLimiter, validate(setPasswordSchema), setPassword);

// OTP password-reset flow: forgot-password -> verify-reset-otp -> reset-password
authRouter.post('/forgot-password', registerLimiter, validate(forgotPasswordSchema), forgotPassword);
authRouter.post('/verify-reset-otp', registerLimiter, validate(verifyResetOtpSchema), verifyResetOtp);
authRouter.post('/reset-password', registerLimiter, validate(resetPasswordSchema), resetPassword);

// Authenticated in-app password change (requires current password).
authRouter.post('/change-password', authenticateToken, validate(changePasswordSchema), changePassword);

authRouter.get('/me', authenticateToken, me);
