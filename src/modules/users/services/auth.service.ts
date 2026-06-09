import bcrypt from "bcryptjs";
import { UserResponseDto } from "../dtos/user-response.dto";
import * as userRepository from "../repositories/user.repository";
import * as emailVerificationRepository from "../repositories/email-verification.repository";
import {
  signUserToken,
  signRegistrationToken,
  verifyRegistrationToken,
} from "../../../utils/token";
import { sendOtpEmail, isEmailConfigured } from "../../../utils/email";

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

  await emailVerificationRepository.invalidateActive(normalized);
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
  const record = await emailVerificationRepository.findActiveByEmail(normalized);

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
  const record = await emailVerificationRepository.findActiveByEmail(normalized);
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
