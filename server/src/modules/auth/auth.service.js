import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { query, withTransaction } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { signToken } from '../../middleware/auth.js';
import { permissionsFor } from '../../config/permissions.js';
import { sendMail } from '../../utils/mailer.js';
import { publish } from '../realtime/realtime.bus.js';

export const PUBLIC_COLUMNS = `id, login_id AS "loginId", name, email, role, is_active AS "isActive",
  created_at AS "createdAt"`;
const INVALID_LOGIN = 'Invalid Login Id or Password';
const INVALID_OTP = () => AppError.badRequest('Invalid or expired OTP', { otp: 'Invalid or expired OTP' });
// Compared against when the login id is unknown, so timing does not leak account existence.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

/** Attach the role's permission list so the UI hides exactly what the API forbids. */
export const withPermissions = (user) => ({ ...user, permissions: permissionsFor(user.role) });

/** Field-level duplicate check shared by sign-up and manager-created accounts. */
export async function assertIdentityAvailable(loginId, email) {
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
}

export const hashPassword = (password) => bcrypt.hash(password, 12);

// Public sign-up always creates Warehouse Staff; managers are promoted by a manager
// or bootstrapped with `npm run create-manager`.
export async function signup({ loginId, name, email, password }) {
  await assertIdentityAvailable(loginId, email);
  const { rows } = await query(
    `INSERT INTO users (login_id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,'staff')
     RETURNING ${PUBLIC_COLUMNS}`,
    [loginId, name, email, await hashPassword(password)],
  );
  return { user: withPermissions(rows[0]), token: signToken(rows[0]) };
}

export async function login({ loginId, password }) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE login_id = $1`,
    [loginId],
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw AppError.unauthorized(INVALID_LOGIN);
  // Only revealed after a correct password, so it does not help account guessing.
  if (!user.isActive) throw AppError.forbidden('Your account has been deactivated. Contact your manager.');
  delete user.password_hash;
  return { user: withPermissions(user), token: signToken(user) };
}

export async function requestPasswordReset({ email }) {
  const { rows } = await query('SELECT id, name FROM users WHERE lower(email) = $1', [email]);
  // Same response whether or not the email exists (prevents account enumeration).
  if (!rows[0]) return;

  const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await query(
    `INSERT INTO password_reset_otps (user_id, otp_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [rows[0].id, await bcrypt.hash(otp, 10), env.OTP_TTL_MINUTES],
  );
  await sendMail({
    to: email,
    subject: 'StockSense password reset code',
    text: `Hi ${rows[0].name},\n\nYour one-time code is ${otp}. It expires in ${env.OTP_TTL_MINUTES} minutes.`,
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
  return withPermissions(rows[0]);
}

export async function updateProfile(userId, { name, email }) {
  const { rows } = await query(
    `UPDATE users SET name = $1, email = $2, updated_at = now() WHERE id = $3 RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, userId],
  );
  await publish({ query }, 'users', { id: userId, action: 'updated' }, { id: userId, name });
  return withPermissions(rows[0]);
}
