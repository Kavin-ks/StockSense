// Shared fixtures for integration tests. Everything goes through the real services + database.
import { pool, query } from '../src/db/pool.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';
import * as wh from '../src/modules/warehouses/warehouses.service.js';
import * as products from '../src/modules/products/products.service.js';
import * as ops from '../src/modules/operations/operations.service.js';

/** Empty every business table and restore the shared virtual locations. */
export async function resetDb() {
  await query(`TRUNCATE stock_moves, stock_quants, operation_lines, operations, operation_sequences,
                reorder_rules, products, product_categories, locations, warehouses,
                user_sessions, user_preferences, daily_digest_log, password_reset_otps, signup_otps, users
                RESTART IDENTITY CASCADE`);
  await query(`INSERT INTO locations (warehouse_id, name, short_code, type) VALUES
                 (NULL, 'Vendors', 'VENDOR', 'vendor'), (NULL, 'Customers', 'CUSTOMER', 'customer'),
                 (NULL, 'Inventory adjustment', 'ADJ', 'inventory_loss')`);
}

let userSeq = 0;
export async function createUser(role = 'manager', overrides = {}) {
  userSeq += 1;
  const loginId = overrides.loginId ?? `user${String(userSeq).padStart(4, '0')}`;
  const { rows } = await query(
    `INSERT INTO users (login_id, name, email, password_hash, role, status, approved_at)
     VALUES ($1, $2, $3, $4, $5, 'active', now()) RETURNING id, name, role`,
    [loginId, overrides.name ?? `Test ${role} ${userSeq}`, overrides.email ?? `${loginId}@test.local`,
      await hashPassword(overrides.password ?? 'Test@12345'), role],
  );
  return { ...rows[0], loginId };
}

/** A warehouse (with its default STOCK location) and a manager to act as. */
export async function setupWarehouse(code = 'WH') {
  const actor = await createUser('manager');
  const warehouse = await wh.createWarehouse({ name: `Warehouse ${code}`, shortCode: code, address: '' }, actor);
  const [stock] = await wh.listLocations({ warehouseId: warehouse.id });
  return { actor, warehouse, stock };
}

export async function createProduct(actor, { sku, stock = 0, locationId, unitCost = 10 } = {}) {
  return products.createProduct(
    { name: `Product ${sku}`, sku, uom: 'Units', unitCost, initialStock: stock || undefined, initialLocationId: stock ? locationId : undefined },
    actor,
  );
}

export async function onHandAt(productId, locationId) {
  const { rows } = await query('SELECT quantity FROM stock_quants WHERE product_id = $1 AND location_id = $2', [productId, locationId]);
  return Number(rows[0]?.quantity ?? 0);
}

export async function countMoves() {
  const { rows } = await query('SELECT count(*)::int AS n FROM stock_moves');
  return rows[0].n;
}

/** Create, confirm and (for deliveries) pick + pack a document so it is ready to validate. */
export async function readyDocument(actor, doc) {
  const op = await ops.createOperation({ scheduledDate: new Date().toISOString().slice(0, 10), ...doc }, actor);
  const confirmed = await ops.confirmOperation(op.id, actor);
  if (doc.type === 'delivery' && confirmed.status === 'ready') {
    await ops.pickDelivery(op.id, { lines: confirmed.lines.map((l) => ({ lineId: l.id, pickedQty: l.quantity })) }, actor);
    await ops.packDelivery(op.id, actor);
  }
  return ops.getOperation(op.id);
}

export const closePool = () => pool.end();
