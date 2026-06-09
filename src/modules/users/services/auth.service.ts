import bcrypt from "bcryptjs";
import { UserResponseDto } from "../dtos/user-response.dto";
import * as userRepository from "../repositories/user.repository";
import * as emailVerificationRepository from "../repositories/email-verification.repository";
import {
  signUserToken,
  signRegistrationToken,
  verifyRegistrationToken,
  signResetToken,
  verifyResetToken,
} from "../../../utils/token";
import {
  sendOtpEmail,
  sendPasswordResetEmail,
  isEmailConfigured,
} from "../../../utils/email";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export const normalizeEmail = (email: string): string =>
  String(email || "").trim().toLowerCase();

const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

const roleName = (user: any): string =>
  user && user.role ? user.role.name : "";

const toAuthUser = (user: any): UserResponseDto & { organizationId: string | null } => ({
  id: user.id.toString(),
  roleId: user.roleId ?? null,
  organizationId: user.organizationId ?? null,
  name: user.name,
  email: user.email,
});

export const login = async (email: string, password: string) => {
  const normalized = normalizeEmail(email);
  const user = await userRepository.findByEmail(normalized);

  if (!user) {
    return { user: null, token: null };
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return { user: null, token: null };
  }

  const token = signUserToken({
    id: user.id.toString(),
    roleId: user.roleId ?? null,
    organizationId: (user as any).organizationId ?? null,
    email: user.email,
    role: roleName(user),
  });

  return { user: toAuthUser(user), token };
};

/**
 * Step 1: start registration. Generates an OTP, stores only its hash, and
 * emails it. Returns the raw code so the controller can decide whether to
 * expose it (demo mode when SMTP isn't configured).
 */
export const startRegistration = async (
  email: string,
): Promise<{ code: string; delivered: boolean }> => {
  const normalized = normalizeEmail(email);

  const existing = await userRepository.findByEmail(normalized);
  if (existing) {
    const err: any = new Error("An account with this email already exists. Please log in.");
    err.statusCode = 409;
    throw err;
  }

  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await emailVerificationRepository.invalidateActiveByPurpose(normalized, "register");
  await emailVerificationRepository.create({
    email: normalized,
    codeHash,
    expiresAt,
    purpose: "register",
  });

  const { delivered } = await sendOtpEmail(normalized, code);
  return { code, delivered };
};

/**
 * Step 2: verify the OTP. On success returns a short-lived registration token
 * that gates the set-password step.
 */
export const verifyOtp = async (
  email: string,
  code: string,
): Promise<{ registrationToken: string }> => {
  const normalized = normalizeEmail(email);
  const record = await emailVerificationRepository.findActiveByEmailAndPurpose(normalized, "register");

  if (!record) {
    throw new Error("No active verification found. Please request a new code.");
  }
  if (record.expiresAt < new Date()) {
    throw new Error("Verification code expired. Please request a new code.");
  }
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    throw new Error("Too many attempts. Please request a new code.");
  }

  const matches = await bcrypt.compare(String(code), record.codeHash);
  if (!matches) {
    record.attempts += 1;
    await record.save();
    throw new Error("Incorrect code. Please try again.");
  }

  record.verified = true;
  await record.save();

  return { registrationToken: signRegistrationToken(normalized) };
};

/**
 * Step 3: set password / create the account. Requires the registration token
 * from step 2 and a verified, unconsumed verification record.
 */
export const completeRegistration = async (
  registrationToken: string,
  name: string,
  password: string,
) => {
  let email: string;
  try {
    email = verifyRegistrationToken(registrationToken);
  } catch {
    const err: any = new Error("Your verification session expired. Please start over.");
    err.statusCode = 401;
    throw err;
  }

  const normalized = normalizeEmail(email);
  const record = await emailVerificationRepository.findActiveByEmailAndPurpose(normalized, "register");
  if (!record || !record.verified) {
    const err: any = new Error("Email not verified. Please verify your email first.");
    err.statusCode = 400;
    throw err;
  }

  const existing = await userRepository.findByEmail(normalized);
  if (existing) {
    const err: any = new Error("An account with this email already exists. Please log in.");
    err.statusCode = 409;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await userRepository.create({
    name,
    email: normalized,
    password: hashedPassword,
    roleId: null,
    organizationId: null,
  });

  record.consumedAt = new Date();
  await record.save();

  const token = signUserToken({
    id: user.id.toString(),
    roleId: null,
    organizationId: null,
    email: normalized,
    role: "",
  });

  return { user: toAuthUser(user), token };
};

/** Returns the freshest profile for the authenticated user (used by /auth/me). */
export const getMe = async (userId: string) => {
  const user = await userRepository.findByIdWithContext(userId);
  if (!user) return null;
  return toAuthUser(user);
};

export const emailDeliveryEnabled = (): boolean => isEmailConfigured();

/**
 * Forgot-password step 1: start a reset. Mirrors startRegistration but uses the
 * 'reset' purpose. To avoid leaking which emails have accounts, this resolves
 * with userExists:false (and no code) when there is no matching account — the
 * controller responds with a generic success either way.
 */
export const startPasswordReset = async (
  email: string,
): Promise<{ code: string | null; delivered: boolean; userExists: boolean }> => {
  const normalized = normalizeEmail(email);
  const user = await userRepository.findByEmail(normalized);

  if (!user) {
    return { code: null, delivered: false, userExists: false };
  }

  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await emailVerificationRepository.invalidateActiveByPurpose(normalized, "reset");
  await emailVerificationRepository.create({
    email: normalized,
    codeHash,
    expiresAt,
    purpose: "reset",
  });

  const { delivered } = await sendPasswordResetEmail(normalized, code);
  return { code, delivered, userExists: true };
};

/** Forgot-password step 2: verify the reset OTP, returning a short-lived reset token. */
export const verifyResetOtp = async (
  email: string,
  code: string,
): Promise<{ resetToken: string }> => {
  const normalized = normalizeEmail(email);
  const record = await emailVerificationRepository.findActiveByEmailAndPurpose(normalized, "reset");

  if (!record) {
    throw new Error("No active reset request found. Please request a new code.");
  }
  if (record.expiresAt < new Date()) {
    throw new Error("Reset code expired. Please request a new code.");
  }
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    throw new Error("Too many attempts. Please request a new code.");
  }

  const matches = await bcrypt.compare(String(code), record.codeHash);
  if (!matches) {
    record.attempts += 1;
    await record.save();
    throw new Error("Incorrect code. Please try again.");
  }

  record.verified = true;
  await record.save();

  return { resetToken: signResetToken(normalized) };
};

/** Forgot-password step 3: set a new password using the reset token from step 2. */
export const completePasswordReset = async (
  resetToken: string,
  password: string,
): Promise<{ success: true }> => {
  let email: string;
  try {
    email = verifyResetToken(resetToken);
  } catch {
    const err: any = new Error("Your reset session expired. Please start over.");
    err.statusCode = 401;
    throw err;
  }

  const normalized = normalizeEmail(email);
  const record = await emailVerificationRepository.findActiveByEmailAndPurpose(normalized, "reset");
  if (!record || !record.verified) {
    const err: any = new Error("Reset not verified. Please verify your code first.");
    err.statusCode = 400;
    throw err;
  }

  const user = await userRepository.findByEmail(normalized);
  if (!user) {
    const err: any = new Error("Account not found.");
    err.statusCode = 404;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await userRepository.update(user.id.toString(), { password: hashedPassword });

  record.consumedAt = new Date();
  await record.save();

  return { success: true };
};

/**
 * Authenticated in-app password change. Requires the current password and only
 * succeeds when it matches the stored hash.
 */
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: true }> => {
  const user = await userRepository.findByIdWithSecret(userId);
  if (!user) {
    const err: any = new Error("User not found.");
    err.statusCode = 404;
    throw err;
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, (user as any).password);
  if (!isCurrentValid) {
    const err: any = new Error("Current password is incorrect.");
    err.statusCode = 401;
    throw err;
  }

  const isSame = await bcrypt.compare(newPassword, (user as any).password);
  if (isSame) {
    const err: any = new Error("New password must be different from your current password.");
    err.statusCode = 400;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await userRepository.update(userId, { password: hashedPassword });

  return { success: true };
};
