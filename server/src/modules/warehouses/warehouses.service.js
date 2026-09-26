import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { publish } from '../realtime/realtime.bus.js';

const WH_COLS = 'w.id, w.name, w.short_code AS "shortCode", w.address, w.created_at AS "createdAt"';
const LOC_COLS = `l.id, l.name, l.short_code AS "shortCode", l.type, l.warehouse_id AS "warehouseId",
  w.short_code || '/' || l.short_code AS "fullCode", w.name AS "warehouseName"`;

export async function listWarehouses() {
  const { rows } = await query(
    `SELECT ${WH_COLS}, count(l.id)::int AS "locationCount"
       FROM warehouses w LEFT JOIN locations l ON l.warehouse_id = w.id
      GROUP BY w.id ORDER BY w.name`,
  );
  return rows;
}

export async function getWarehouse(id) {
  const { rows } = await query(`SELECT ${WH_COLS} FROM warehouses w WHERE w.id = $1`, [id]);
  if (!rows[0]) throw AppError.notFound('Warehouse');
  return rows[0];
}

// A new warehouse always gets a default "Stock" location so it can receive goods immediately.
export async function createWarehouse({ name, shortCode, address }, actor) {
  return withTransaction(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO warehouses (name, short_code, address) VALUES ($1,$2,$3)
       RETURNING id, name, short_code AS "shortCode", address`,
      [name, shortCode, address],
    );
    await db.query(
      `INSERT INTO locations (warehouse_id, name, short_code) VALUES ($1, 'Stock', 'STOCK')`,
      [rows[0].id],
    );
    await publish(db, 'warehouses', { id: rows[0].id, action: 'created' }, actor);
    return rows[0];
  });
}

export async function updateWarehouse(id, { name, shortCode, address }, actor) {
  const { rows } = await query(
    `UPDATE warehouses SET name=$1, short_code=$2, address=$3 WHERE id=$4
     RETURNING id, name, short_code AS "shortCode", address`,
    [name, shortCode, address, id],
  );
  if (!rows[0]) throw AppError.notFound('Warehouse');
  await publish({ query }, 'warehouses', { id, action: 'updated' }, actor);
  return rows[0];
}

export async function listLocations({ warehouseId, includeVirtual = false } = {}) {
  const where = [];
  const params = [];
  if (warehouseId) { params.push(warehouseId); where.push(`l.warehouse_id = $${params.length}`); }
  if (!includeVirtual) where.push(`l.type = 'internal'`);
  const { rows } = await query(
    `SELECT ${LOC_COLS} FROM locations l LEFT JOIN warehouses w ON w.id = l.warehouse_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY w.name NULLS LAST, l.name`,
    params,
  );
  return rows;
}

export async function createLocation({ warehouseId, name, shortCode }, actor) {
  await getWarehouse(warehouseId);
  const { rows } = await query(
    `INSERT INTO locations (warehouse_id, name, short_code) VALUES ($1,$2,$3) RETURNING id`,
    [warehouseId, name, shortCode],
  );
  await publish({ query }, 'locations', { id: rows[0].id, action: 'created' }, actor);
  return getLocation(rows[0].id);
}

export async function updateLocation(id, { warehouseId, name, shortCode }, actor) {
  const { rowCount } = await query(
    `UPDATE locations SET warehouse_id=$1, name=$2, short_code=$3 WHERE id=$4 AND type='internal'`,
    [warehouseId, name, shortCode, id],
  );
  if (!rowCount) throw AppError.notFound('Location');
  await publish({ query }, 'locations', { id, action: 'updated' }, actor);
  return getLocation(id);
}

export async function getLocation(id, db = { query }) {
  const { rows } = await db.query(
    `SELECT ${LOC_COLS} FROM locations l LEFT JOIN warehouses w ON w.id = l.warehouse_id WHERE l.id = $1`,
    [id],
  );
  if (!rows[0]) throw AppError.notFound('Location');
  return rows[0];
}

/** Id of a shared virtual location ('vendor' | 'customer' | 'inventory_loss'). */
export async function virtualLocationId(type, db = { query }) {
  const { rows } = await db.query(`SELECT id FROM locations WHERE type = $1 AND warehouse_id IS NULL`, [type]);
  return rows[0].id;
}

/** The warehouse's default internal location (first created). */
export async function defaultLocationId(warehouseId, db = { query }) {
  const { rows } = await db.query(
    `SELECT id FROM locations WHERE warehouse_id = $1 AND type = 'internal' AND is_active ORDER BY id LIMIT 1`,
    [warehouseId],
  );
  if (!rows[0]) throw AppError.badRequest('This warehouse has no locations yet');
  return rows[0].id;
}

/**
 * Validate a warehouse/location filter pair used by list and dashboard queries.
 * A location from a different warehouse is a user error. The location does NOT imply a warehouse
 * filter: a cross-warehouse transfer belongs to one warehouse but touches locations in another.
 */
export async function resolveScope({ warehouseId, locationId }) {
  if (!locationId) return { warehouseId: warehouseId ?? null, locationId: null };
  const { rows } = await query(`SELECT warehouse_id FROM locations WHERE id = $1 AND type = 'internal'`, [locationId]);
  if (!rows[0]) throw AppError.badRequest('Invalid location filter', { locationId: 'Location not found' });
  if (warehouseId && rows[0].warehouse_id !== warehouseId) {
    throw AppError.badRequest('Location does not belong to the selected warehouse', {
      locationId: 'Location does not belong to the selected warehouse',
    });
  }
  return { warehouseId: warehouseId ?? null, locationId };
}
