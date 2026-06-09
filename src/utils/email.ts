import nodemailer, { Transporter } from 'nodemailer';

const smtpConfigured = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

let transporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
  if (!smtpConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

export const isEmailConfigured = (): boolean => smtpConfigured;

/**
 * When SMTP is not configured we still return success so the flow stays usable
 * for demos/local dev — the OTP is logged and (when allowed) echoed by the
 * controller in the API response. Configure SMTP_* to send real emails.
 */
export const sendOtpEmail = async (
  to: string,
  code: string,
): Promise<{ delivered: boolean }> => {
  const t = getTransporter();
  const appName = process.env.SERVICE_NAME || 'Service Ticket System';

  if (!t) {
    console.log(`[email:dev] Verification code for ${to}: ${code} (SMTP not configured)`);
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
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `${appName} — your verification code`,
    text: `Your ${appName} verification code is ${code}. It expires in 10 minutes.`,
    html,
  });

  return { delivered: true };
};
