import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { PUBLIC_COLUMNS, assertIdentityAvailable, hashPassword } from '../auth/auth.service.js';
import { publish } from '../realtime/realtime.bus.js';

export async function listUsers({ search, role, status, page, pageSize }) {
  const where = [];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (search) add('(name ILIKE ? OR login_id ILIKE ? OR email ILIKE ?)', `%${search}%`);
  if (role) add('role = ?', role);
  if (status) add('status = ?', status);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [{ rows }, count, pending] = await Promise.all([
    // Pending sign-ups first (they need action), then active, then deactivated.
    query(`SELECT ${PUBLIC_COLUMNS} FROM users ${whereSql}
           ORDER BY array_position(ARRAY['pending','active','deactivated']::user_status[], status), role, name
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, (page - 1) * pageSize]),
    query(`SELECT count(*)::int AS total FROM users ${whereSql}`, params),
    query(`SELECT count(*)::int AS n FROM users WHERE status = 'pending'`),
  ]);
  return { rows, total: count.rows[0].total, pendingCount: pending.rows[0].n };
}

export async function pendingCount() {
  const { rows } = await query(`SELECT count(*)::int AS n FROM users WHERE status = 'pending'`);
  return rows[0].n;
}

/** Manager-created accounts are trusted, so they are active (approved by the creator) immediately. */
export async function createUser({ loginId, name, email, role, password }, actor) {
  await assertIdentityAvailable(loginId, email);
  const { rows } = await query(
    `INSERT INTO users (login_id, name, email, password_hash, role, status, created_by, approved_by, approved_at)
     VALUES ($1,$2,$3,$4,$5,'active',$6,$6,now()) RETURNING ${PUBLIC_COLUMNS}`,
    [loginId, name, email, await hashPassword(password), role, actor.id],
  );
  await publish({ query }, 'users', { id: rows[0].id, action: 'created', status: 'active' }, actor);
  return rows[0];
}

async function lockPending(db, id) {
  const { rows } = await db.query('SELECT id, status, name FROM users WHERE id = $1 FOR UPDATE', [id]);
  if (!rows[0]) throw AppError.notFound('User');
  // Two managers may act on the same request at once: the second one gets a clear answer.
  if (rows[0].status !== 'pending') {
    throw AppError.conflict(`${rows[0].name} is already ${rows[0].status}; only pending sign-ups can be approved or rejected`);
  }
  return rows[0];
}

export async function approveUser(id, { role }, actor) {
  return withTransaction(async (db) => {
    await lockPending(db, id);
    const { rows } = await db.query(
      `UPDATE users SET status = 'active', role = $1, approved_by = $2, approved_at = now(), updated_at = now()
        WHERE id = $3 RETURNING ${PUBLIC_COLUMNS}`,
      [role, actor.id, id],
    );
    await publish(db, 'users', { id, action: 'approved', role, status: 'active' }, actor);
    return rows[0];
  });
}

/** Rejecting deletes the request: a pending account never acted, so nothing references it. */
export async function rejectUser(id, actor) {
  return withTransaction(async (db) => {
    const user = await lockPending(db, id);
    await db.query(`DELETE FROM users WHERE id = $1 AND status = 'pending'`, [id]);
    await publish(db, 'users', { id, action: 'rejected', name: user.name }, actor);
  });
}

/**
 * Change an approved member's role or status.
 * Invariants (checked under row locks so two managers acting at once can't break them):
 *   - you cannot change your own role/status (prevents accidental self-lockout)
 *   - there is always at least one active manager
 */
export async function updateUser(id, { role, status }, actor) {
  if (id === actor.id) {
    throw AppError.badRequest('You cannot change your own role or status. Ask another manager.');
  }
  return withTransaction(async (db) => {
    const { rows: managers } = await db.query(
      `SELECT id FROM users WHERE role = 'manager' AND status = 'active' ORDER BY id FOR UPDATE`,
    );
    const { rows } = await db.query('SELECT id, role, status FROM users WHERE id = $1 FOR UPDATE', [id]);
    const target = rows[0];
    if (!target) throw AppError.notFound('User');
    if (target.status === 'pending') throw AppError.badRequest('Approve or reject this sign-up first');

    const nextRole = role ?? target.role;
    const nextStatus = status ?? target.status;
    const wasActiveManager = target.role === 'manager' && target.status === 'active';
    const losesManager = wasActiveManager && (nextRole !== 'manager' || nextStatus !== 'active');
    if (losesManager && managers.length <= 1) {
      throw AppError.conflict('StockSense needs at least one active manager');
    }

    const { rows: updated } = await db.query(
      `UPDATE users SET role = $1, status = $2, updated_at = now() WHERE id = $3 RETURNING ${PUBLIC_COLUMNS}`,
      [nextRole, nextStatus, id],
    );
    await publish(db, 'users', { id, action: 'updated', role: nextRole, status: nextStatus }, actor);
    return updated[0];
  });
}
