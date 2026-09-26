import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';

const smtpPassword = env.SMTP_PASSWORD || env.SMTP_PASS;

// Brevo / SMTP transport when configured; otherwise falls back to console in development.
const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT),
      secure: Number(env.SMTP_PORT) === 465, // false for 587 (uses STARTTLS)
      auth: env.SMTP_USER
        ? {
            user: env.SMTP_USER,
            pass: smtpPassword,
          }
        : undefined,
    })
  : null;

export async function sendMail({ to, subject, text, html }) {
  if (!transport) {
    console.info(`[mail:dev] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  try {
    await transport.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    // Log safe diagnostic message without leaking credentials or internal stack
    console.error(`[mail:error] Failed to send email to ${to}:`, err.message || 'SMTP error');
    throw new AppError(500, 'Unable to send password reset email at this time. Please try again later.');
  }
}

