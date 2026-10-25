import nodemailer from 'nodemailer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function renderVerificationEmail({ safeName, safeUrl }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Verify your SwiftBid email</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Confirm your email to start bidding and selling on SwiftBid. This link expires in 24 hours.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
          <tr>
            <td style="background-color:#0f172a;padding:28px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <img src="cid:swiftbid-logo" width="24" height="24" alt="SwiftBid" style="display:block;margin:8px auto;border:0;" />
                  </td>
                  <td style="padding-left:12px;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">SwiftBid</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 8px 32px;">
              <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.3;font-weight:800;color:#0f172a;">Confirm your email address</h1>
              <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#334155;">Hi ${safeName},</p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#334155;">Welcome to SwiftBid. Confirm your email to start bidding, make instant offers, and list items for sale.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                <tr>
                  <td style="background-color:#0265d2;border-radius:10px;">
                    <a href="${safeUrl}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Verify email address</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px 0;font-size:13px;line-height:1.6;color:#64748b;">This link expires in 24 hours. If the button doesn't work, copy and paste this URL into your browser:</p>
              <p style="margin:0 0 28px 0;font-size:13px;line-height:1.6;word-break:break-all;color:#0265d2;">
                <a href="${safeUrl}" style="color:#0265d2;text-decoration:underline;">${safeUrl}</a>
              </p>
              <div style="border-top:1px solid #e2e8f0;padding-top:20px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">If you didn't create a SwiftBid account, you can safely ignore this email — no action is needed.</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:12px;line-height:1.6;color:#94a3b8;">SwiftBid · Live auctions and instant offers</td>
                </tr>
                <tr>
                  <td style="padding-top:6px;font-size:12px;line-height:1.6;color:#94a3b8;">This is an automated message. Please don't reply to this email.</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail({ email, fullName, token }) {
  if (
    !env.SMTP_HOST ||
    !env.EMAIL_FROM ||
    Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)
  ) {
    throw new AppError(
      503,
      'Email delivery is not configured. Please try again later.',
      'EMAIL_DELIVERY_FAILED'
    );
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER
      ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
      : {}),
  });

  const verificationUrl = new URL('/verify-email', env.FRONTEND_URL);
  verificationUrl.searchParams.set('token', token);

  const safeName = escapeHtml(fullName);
  const safeUrl = escapeHtml(verificationUrl.href);

  const text = [
    `Hi ${fullName},`,
    '',
    'Welcome to SwiftBid. Confirm your email address within 24 hours to start bidding, making instant offers, and listing items for sale:',
    verificationUrl.href,
    '',
    "If you didn't create a SwiftBid account, you can safely ignore this email.",
    '',
    '— SwiftBid · Live auctions and instant offers',
  ].join('\n');

  const html = renderVerificationEmail({ safeName, safeUrl });

  const logoPath = path.join(__dirname, '..', '..', 'public', 'icon.png');

  try {
    await transporter.sendMail({
      from: { name: 'SwiftBid', address: env.EMAIL_FROM },
      to: email,
      subject: 'Verify your SwiftBid email address',
      text,
      html,
      attachments: [
        {
          filename: 'icon.png',
          path: logoPath,
          cid: 'swiftbid-logo',
        },
      ],
    });
  } catch (error) {
    console.error('Failed to send email verification message:', error.message);
    throw new AppError(
      503,
      'We could not send the verification email. Please try again shortly.',
      'EMAIL_DELIVERY_FAILED'
    );
  }
}