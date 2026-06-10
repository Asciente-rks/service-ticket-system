import nodemailer, { Transporter } from 'nodemailer';

// Simple Gmail setup: just an address + 16-char app password.
//   EMAIL_USER=you@gmail.com
//   EMAIL_PASS=xxxxxxxxxxxxxxxx   (Google App Password, no spaces)
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const emailConfigured = !!(emailUser && emailPass);

let transporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
  if (!emailConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });
  }
  return transporter;
};

export const isEmailConfigured = (): boolean => emailConfigured;

/**
 * When email isn't configured we still return success so the flow stays usable
 * for demos/local dev — the OTP is logged and (when allowed) echoed by the
 * controller in the API response. Set EMAIL_USER + EMAIL_PASS to send real mail.
 */
export const sendOtpEmail = async (
  to: string,
  code: string,
): Promise<{ delivered: boolean }> => {
  const t = getTransporter();
  const appName = process.env.SERVICE_NAME || 'Service Ticket System';

  if (!t) {
    console.log(`[email:dev] Verification code for ${to}: ${code} (email not configured)`);
    return { delivered: false };
  }

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:16px">
    <h2 style="margin:0 0 8px;color:#0f172a">Verify your email</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6">
      Use the code below to finish creating your ${appName} account. It expires in 10 minutes.
    </p>
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;text-align:center;padding:20px;margin:20px 0;background:#0f172a;color:#fff;border-radius:12px">
      ${code}
    </div>
    <p style="color:#94a3b8;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
  </div>`;

  await t.sendMail({
    from: `${appName} <${emailUser}>`,
    to,
    subject: `${appName} — your verification code`,
    text: `Your ${appName} verification code is ${code}. It expires in 10 minutes.`,
    html,
  });

  return { delivered: true };
};

/**
 * Sends a password-reset OTP. Same dev-mode behaviour as sendOtpEmail: when
 * email isn't configured the code is logged (and echoed by the controller).
 */
export const sendPasswordResetEmail = async (
  to: string,
  code: string,
): Promise<{ delivered: boolean }> => {
  const t = getTransporter();
  const appName = process.env.SERVICE_NAME || 'Service Ticket System';

  if (!t) {
    console.log(`[email:dev] Password reset code for ${to}: ${code} (email not configured)`);
    return { delivered: false };
  }

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:16px">
    <h2 style="margin:0 0 8px;color:#0f172a">Reset your password</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6">
      Use the code below to reset your ${appName} password. It expires in 10 minutes.
      If you didn't request a reset, you can safely ignore this email — your password won't change.
    </p>
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;text-align:center;padding:20px;margin:20px 0;background:#0f172a;color:#fff;border-radius:12px">
      ${code}
    </div>
    <p style="color:#94a3b8;font-size:12px">For your security, never share this code with anyone.</p>
  </div>`;

  await t.sendMail({
    from: `${appName} <${emailUser}>`,
    to,
    subject: `${appName} — your password reset code`,
    text: `Your ${appName} password reset code is ${code}. It expires in 10 minutes.`,
    html,
  });

  return { delivered: true };
};
