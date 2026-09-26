import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { can } from '../config/permissions.js';
import { query } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** Why a non-active account cannot use the app (shown on the login screen). */
export const STATUS_MESSAGES = {
  pending: 'Your account is waiting for approval by an inventory manager.',
  deactivated: 'Your account has been deactivated. Contact your manager.',
  deleted: 'This account no longer exists.',
};

const SESSION_ENDED = 'You were signed out. Please sign in again.';

/** Session JWT. `sid` points at a user_sessions row, so the session can be listed and revoked. */
export function signToken(user, sessionId) {
  return jwt.sign({ sub: user.id, sid: sessionId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

/** Short-lived token used only to open the live-updates stream (EventSource cannot send headers). */
export function signStreamToken(user) {
  return jwt.sign({ sub: user.id, sid: user.sessionId, purpose: 'events' }, env.JWT_SECRET, { expiresIn: '60s' });
}

/** Record a sign-in and return its id (stored in the JWT). */
export async function createSession(userId, { userAgent, ip } = {}) {
  const { rows } = await query(
    'INSERT INTO user_sessions (user_id, user_agent, ip_address) VALUES ($1, $2, $3) RETURNING id',
    [userId, userAgent?.slice(0, 400) ?? null, ip?.slice(0, 64) ?? null],
  );
  return Number(rows[0].id);
}

/**
 * Resolve the *current* user for a token. Role and active flag are read from the
 * database on every request, so a role change or deactivation applies immediately
 * instead of waiting for the JWT to expire. (Primary-key lookup: negligible cost.)
 */
export async function userFromToken(token, purpose) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw AppError.unauthorized('Your session has expired. Please sign in again.');
  }
  if ((payload.purpose ?? null) !== (purpose ?? null)) throw AppError.unauthorized();

  if (!payload.sid) throw AppError.unauthorized(SESSION_ENDED); // token issued before sessions existed

  // One indexed lookup: the user's current role/status and whether this session is still valid.
  const { rows } = await query(
    `SELECT u.id, u.name, u.role, u.status, s.revoked_at, s.last_seen_at < now() - interval '1 minute' AS stale
       FROM users u LEFT JOIN user_sessions s ON s.id = $2 AND s.user_id = u.id
      WHERE u.id = $1`,
    [payload.sub, payload.sid],
  );
  const user = rows[0];
  if (!user) throw AppError.unauthorized();
  if (user.status !== 'active') throw AppError.unauthorized(STATUS_MESSAGES[user.status]);
  if (user.stale === null || user.revoked_at) throw AppError.unauthorized(SESSION_ENDED);
  // Keep "last active" fresh without writing on every request.
  if (user.stale) query('UPDATE user_sessions SET last_seen_at = now() WHERE id = $1', [payload.sid]).catch(() => {});
  return { id: user.id, name: user.name, role: user.role, sessionId: payload.sid };
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw AppError.unauthorized();
  req.user = await userFromToken(token);
  next();
});

export function assertCan(user, permission) {
  if (!can(user?.role, permission)) {
    throw AppError.forbidden(user?.role === 'staff'
      ? 'This action is reserved for inventory managers'
      : 'You do not have access to this action');
  }
}

export const requirePermission = (permission) => (req, _res, next) => {
  assertCan(req.user, permission);
  next();
};
