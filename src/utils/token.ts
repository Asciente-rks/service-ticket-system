import jwt from 'jsonwebtoken';

export interface TokenUser {
  id: string;
  roleId: string | null;
  organizationId: string | null;
  email: string;
  role: string;
}

const SESSION_EXPIRY = process.env.JWT_EXPIRES_IN || '8h';
const REGISTRATION_EXPIRY = '15m';

/** Signs the main session JWT consumed by auth.middleware on every request. */
export const signUserToken = (user: TokenUser): string =>
  jwt.sign(
    {
      id: user.id,
      roleId: user.roleId,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET!,
    { expiresIn: SESSION_EXPIRY } as jwt.SignOptions,
  );

/** Short-lived token proving an email was OTP-verified, used to gate set-password. */
export const signRegistrationToken = (email: string): string =>
  jwt.sign({ email, purpose: 'register' }, process.env.JWT_SECRET!, {
    expiresIn: REGISTRATION_EXPIRY,
  } as jwt.SignOptions);

export const verifyRegistrationToken = (token: string): string => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
  if (!decoded || decoded.purpose !== 'register' || !decoded.email) {
    throw new Error('Invalid registration token');
  }
  return decoded.email as string;
};

/** Short-lived token proving an email was OTP-verified, used to gate reset-password. */
export const signResetToken = (email: string): string =>
  jwt.sign({ email, purpose: 'reset' }, process.env.JWT_SECRET!, {
    expiresIn: REGISTRATION_EXPIRY,
  } as jwt.SignOptions);

export const verifyResetToken = (token: string): string => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
  if (!decoded || decoded.purpose !== 'reset' || !decoded.email) {
    throw new Error('Invalid reset token');
  }
  return decoded.email as string;
};
