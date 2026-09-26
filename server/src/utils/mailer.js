import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// Uses the organisation's own SMTP server when configured; otherwise logs mail
// to the console so the OTP flow still works on a developer machine.
const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

export async function sendMail({ to, subject, text }) {
  if (!transport) {
    console.info(`[mail:dev] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  await transport.sendMail({ from: env.SMTP_FROM, to, subject, text });
}
