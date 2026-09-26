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
  if (status) add('is_active = ?', status === 'active');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [{ rows }, count] = await Promise.all([
    query(`SELECT ${PUBLIC_COLUMNS} FROM users ${whereSql}
           ORDER BY is_active DESC, role, name
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, (page - 1) * pageSize]),
    query(`SELECT count(*)::int AS total FROM users ${whereSql}`, params),
  ]);
  return { rows, total: count.rows[0].total };
}

export async function createUser({ loginId, name, email, role, password }, actor) {
  await assertIdentityAvailable(loginId, email);
  const { rows } = await query(
    `INSERT INTO users (login_id, name, email, password_hash, role, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${PUBLIC_COLUMNS}`,
    [loginId, name, email, await hashPassword(password), role, actor.id],
  );
  await publish({ query }, 'users', { id: rows[0].id, action: 'created' }, actor);
  return rows[0];
}

/**
 * Change a member's role or active flag.
 * Invariants (checked under row locks so two managers acting at once can't break them):
 *   - you cannot change your own role/status (prevents accidental self-lockout)
 *   - there is always at least one active manager
 */
export async function updateUser(id, { role, isActive }, actor) {
  if (id === actor.id) {
    throw AppError.badRequest('You cannot change your own role or status. Ask another manager.');
  }
  return withTransaction(async (db) => {
    const { rows: managers } = await db.query(
      `SELECT id FROM users WHERE role = 'manager' AND is_active ORDER BY id FOR UPDATE`,
    );
    const { rows } = await db.query('SELECT id, role, is_active FROM users WHERE id = $1 FOR UPDATE', [id]);
    const target = rows[0];
    if (!target) throw AppError.notFound('User');

    const nextRole = role ?? target.role;
    const nextActive = isActive ?? target.is_active;
    const losesManager = target.role === 'manager' && target.is_active && (nextRole !== 'manager' || !nextActive);
    if (losesManager && managers.length <= 1) {
      throw AppError.conflict('StockSense needs at least one active manager');
    }

    const { rows: updated } = await db.query(
      `UPDATE users SET role = $1, is_active = $2, updated_at = now() WHERE id = $3 RETURNING ${PUBLIC_COLUMNS}`,
      [nextRole, nextActive, id],
    );
    await publish(db, 'users', { id, action: 'updated', role: nextRole, isActive: nextActive }, actor);
    return updated[0];
  });
}
