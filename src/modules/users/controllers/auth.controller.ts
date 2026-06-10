import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { LoginDto } from "../dtos/login.dto";
import { AuthRequest } from "../../../middlewares/auth.middleware";

const EXPOSE_OTP = (process.env.EXPOSE_OTP || "false").toLowerCase() === "true";

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginDto;
    const { user, token } = await authService.login(email, password);
    if (!user || !token) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    res.status(200).json({ user, token });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed. Please try again." });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email: string };
    const { code, delivered } = await authService.startRegistration(email);

    // Demo convenience: when real email delivery isn't set up (or EXPOSE_OTP is
    // on), return the code so the flow is testable without an inbox.
    const exposeCode = EXPOSE_OTP || !authService.emailDeliveryEnabled();

    res.status(200).json({
      message: delivered
        ? "Verification code sent to your email."
        : "Verification code generated.",
      emailDelivered: delivered,
      ...(exposeCode ? { devOtp: code } : {}),
    });
  } catch (error: any) {
    const status = error.statusCode || 400;
    res.status(status).json({ message: error.message || "Could not start registration." });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body as { email: string; code: string };
    const { registrationToken } = await authService.verifyOtp(email, code);
    res.status(200).json({ verified: true, registrationToken });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Verification failed." });
  }
};

export const setPassword = async (req: Request, res: Response) => {
  try {
    const { registrationToken, name, password } = req.body as {
      registrationToken: string;
      name: string;
      password: string;
    };
    const { user, token } = await authService.completeRegistration(
      registrationToken,
      name,
      password,
    );
    res.status(201).json({ user, token });
  } catch (error: any) {
    const status = error.statusCode || 400;
    res.status(status).json({ message: error.message || "Could not complete registration." });
  }
};

export const me = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const user = await authService.getMe(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
  } catch (error: any) {
    console.error("Me error:", error);
    res.status(500).json({ message: "Could not load profile." });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email: string };
    const { code, delivered, userExists } = await authService.startPasswordReset(email);

    // Demo convenience: expose the code only when the account exists AND email
    // delivery isn't configured (or EXPOSE_OTP is on).
    const exposeCode = userExists && (EXPOSE_OTP || !authService.emailDeliveryEnabled());

    // Generic response regardless of whether the account exists (no enumeration).
    res.status(200).json({
      message: "If an account exists for that email, a reset code has been sent.",
      emailDelivered: delivered,
      ...(exposeCode && code ? { devOtp: code } : {}),
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Could not start password reset." });
  }
};

export const verifyResetOtp = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body as { email: string; code: string };
    const { resetToken } = await authService.verifyResetOtp(email, code);
    res.status(200).json({ verified: true, resetToken });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Verification failed." });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { resetToken, password } = req.body as { resetToken: string; password: string };
    await authService.completePasswordReset(resetToken, password);
    res.status(200).json({ success: true, message: "Your password has been reset. You can now sign in." });
  } catch (error: any) {
    const status = error.statusCode || 400;
    res.status(status).json({ message: error.message || "Could not reset password." });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    await authService.changePassword(req.user.id, currentPassword, newPassword);
    res.status(200).json({ success: true, message: "Your password has been updated." });
  } catch (error: any) {
    const status = error.statusCode || 400;
    res.status(status).json({ message: error.message || "Could not change password." });
  }
};
