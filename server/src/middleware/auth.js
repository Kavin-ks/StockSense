import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { can } from '../config/permissions.js';
import { query } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

/** Short-lived token used only to open the live-updates stream (EventSource cannot send headers). */
export function signStreamToken(user) {
  return jwt.sign({ sub: user.id, purpose: 'events' }, env.JWT_SECRET, { expiresIn: '60s' });
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

  const { rows } = await query('SELECT id, name, role, is_active FROM users WHERE id = $1', [payload.sub]);
  const user = rows[0];
  if (!user) throw AppError.unauthorized();
  if (!user.is_active) throw AppError.unauthorized('Your account has been deactivated. Contact your manager.');
  return { id: user.id, name: user.name, role: user.role };
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
