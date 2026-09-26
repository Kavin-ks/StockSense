import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { query, withTransaction } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { signToken } from '../../middleware/auth.js';
import { sendMail } from '../../utils/mailer.js';

const PUBLIC_COLUMNS = 'id, login_id AS "loginId", name, email, role, created_at AS "createdAt"';
const INVALID_LOGIN = 'Invalid Login Id or Password';
const INVALID_OTP = () => AppError.badRequest('Invalid or expired OTP', { otp: 'Invalid or expired OTP' });
// Compared against when the login id is unknown, so timing does not leak account existence.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

export async function requestSignupOtp({ loginId, name, email }) {
  const clash = await query(
    'SELECT login_id, email FROM users WHERE login_id = $1 OR lower(email) = $2',
    [loginId, email],
  );
  const fields = {};
  for (const row of clash.rows) {
    if (row.login_id === loginId) fields.loginId = 'This Login ID is already taken';
    if (row.email.toLowerCase() === email) fields.email = 'This email is already registered';
  }
  if (Object.keys(fields).length) throw AppError.conflict('Account already exists', fields);

  const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await query(
    `INSERT INTO signup_otps (email, otp_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [email.toLowerCase(), await bcrypt.hash(otp, 10), env.OTP_TTL_MINUTES],
  );

  await sendMail({
    to: email,
    subject: 'StockSense sign-up verification code',
    text: `StockSense — Email Verification\n\nHi ${name},\n\nYour one-time sign-up verification code is: ${otp}\n\nThis code will expire in ${env.OTP_TTL_MINUTES} minutes.\nIf you did not request to create a StockSense account, please ignore this email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e3e6ef; border-radius: 12px; background-color: #ffffff; color: #1c2130;">
        <h2 style="color: #4f46e5; margin: 0 0 16px 0; font-size: 22px;">StockSense</h2>
        <p style="font-size: 15px; margin: 0 0 12px 0;">Hi <strong>${name}</strong>,</p>
        <p style="font-size: 14px; margin: 0 0 20px 0; color: #4b5563;">Thank you for registering with StockSense. Use the verification code below to verify your email and complete account setup:</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; padding: 16px 24px; background-color: #f1f3f9; border-radius: 8px; text-align: center; margin: 20px 0; color: #1c2130; border: 1px solid #e3e6ef;">
          ${otp}
        </div>
        <p style="font-size: 13px; color: #6b7289; margin: 16px 0 0 0;">This code will expire in <strong>${env.OTP_TTL_MINUTES} minutes</strong>. If you did not create a StockSense account, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e3e6ef; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">StockSense Inventory Management System</p>
      </div>
    `,
  });

  return { message: 'Verification code sent to your email.' };
}

export async function signup({ loginId, name, email, password, otp }) {
  const clash = await query(
    'SELECT login_id, email FROM users WHERE login_id = $1 OR lower(email) = $2',
    [loginId, email],
  );
  const fields = {};
  for (const row of clash.rows) {
    if (row.login_id === loginId) fields.loginId = 'This Login ID is already taken';
    if (row.email.toLowerCase() === email) fields.email = 'This email is already registered';
  }
  if (Object.keys(fields).length) throw AppError.conflict('Account already exists', fields);

  if (otp) {
    const outcome = await withTransaction(async (db) => {
      const { rows } = await db.query(
        `SELECT id, otp_hash, attempts
           FROM signup_otps
          WHERE lower(email) = $1 AND used_at IS NULL AND expires_at > now()
          ORDER BY created_at DESC LIMIT 1
          FOR UPDATE`,
        [email.toLowerCase()],
      );
      const record = rows[0];
      if (!record || record.attempts >= env.OTP_MAX_ATTEMPTS) return 'invalid';

      if (!(await bcrypt.compare(otp, record.otp_hash))) {
        await db.query('UPDATE signup_otps SET attempts = attempts + 1 WHERE id = $1', [record.id]);
        return 'invalid';
      }

      await db.query('UPDATE signup_otps SET used_at = now() WHERE id = $1', [record.id]);
      return 'ok';
    });

    if (outcome === 'invalid') {
      throw AppError.badRequest('Invalid or expired verification code', { otp: 'Invalid or expired verification code' });
    }
  }

  const hash = await bcrypt.hash(password, 12);
  const { rows } = await query(
    `INSERT INTO users (login_id, name, email, password_hash) VALUES ($1,$2,$3,$4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [loginId, name, email, hash],
  );
  return { user: rows[0], token: signToken(rows[0]) };
}

export async function login({ loginId, password }) {
  const identifier = loginId.trim();
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE login_id = $1 OR lower(email) = $2 OR lower(login_id) = $2`,
    [identifier, identifier.toLowerCase()],
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw AppError.unauthorized(INVALID_LOGIN);
  delete user.password_hash;
  return { user, token: signToken(user) };
}

export async function requestPasswordReset({ email }) {
  const { rows } = await query('SELECT id, name, login_id FROM users WHERE lower(email) = $1', [email]);
  if (!rows[0]) {
    throw AppError.notFound('No account found with this email address', {
      email: 'No account found with this email address',
    });
  }

  const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await query(
    `INSERT INTO password_reset_otps (user_id, otp_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [rows[0].id, await bcrypt.hash(otp, 10), env.OTP_TTL_MINUTES],
  );
  await sendMail({
    to: email,
    subject: 'StockSense password reset code',
    text: `StockSense — Password Reset\n\nHi ${rows[0].name} (Login ID: ${rows[0].login_id}),\n\nYour one-time password reset code is: ${otp}\n\nThis code will expire in ${env.OTP_TTL_MINUTES} minutes.\nIf you did not request a password reset, please ignore this email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e3e6ef; border-radius: 12px; background-color: #ffffff; color: #1c2130;">
        <h2 style="color: #4f46e5; margin: 0 0 16px 0; font-size: 22px;">StockSense</h2>
        <p style="font-size: 15px; margin: 0 0 12px 0;">Hi <strong>${rows[0].name}</strong> (Login ID: <code>${rows[0].login_id}</code>),</p>
        <p style="font-size: 14px; margin: 0 0 20px 0; color: #4b5563;">You requested a password reset for your StockSense account. Use the verification code below to complete your reset:</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; padding: 16px 24px; background-color: #f1f3f9; border-radius: 8px; text-align: center; margin: 20px 0; color: #1c2130; border: 1px solid #e3e6ef;">
          ${otp}
        </div>
        <p style="font-size: 13px; color: #6b7289; margin: 16px 0 0 0;">This code will expire in <strong>${env.OTP_TTL_MINUTES} minutes</strong>. If you did not request a password reset, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e3e6ef; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">StockSense Inventory Management System</p>
      </div>
    `,
  });
}

export async function resetPassword({ email, otp, password }) {
  // The attempt counter must be committed even when the OTP is wrong,
  // so the transaction returns an outcome instead of throwing.
  const outcome = await withTransaction(async (db) => {
    const { rows } = await db.query(
      `SELECT o.id, o.otp_hash, o.attempts, o.user_id
         FROM password_reset_otps o JOIN users u ON u.id = o.user_id
        WHERE lower(u.email) = $1 AND o.used_at IS NULL AND o.expires_at > now()
        ORDER BY o.created_at DESC LIMIT 1
        FOR UPDATE OF o`,
      [email],
    );
    const record = rows[0];
    if (!record || record.attempts >= env.OTP_MAX_ATTEMPTS) return 'invalid';

    if (!(await bcrypt.compare(otp, record.otp_hash))) {
      await db.query('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = $1', [record.id]);
      return 'invalid';
    }
    await db.query('UPDATE password_reset_otps SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [record.user_id]);
    await db.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
      await bcrypt.hash(password, 12),
      record.user_id,
    ]);
    return 'ok';
  });
  if (outcome === 'invalid') throw INVALID_OTP();
}

export async function getProfile(userId) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [userId]);
  if (!rows[0]) throw AppError.notFound('User');
  return rows[0];
}

export async function updateProfile(userId, { name, email }) {
  const { rows } = await query(
    `UPDATE users SET name = $1, email = $2, updated_at = now() WHERE id = $3 RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, userId],
  );
  return rows[0];
}
