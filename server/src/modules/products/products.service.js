import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { moveStock, nextReference } from '../stock/stock.service.js';
import { resolveScope, virtualLocationId } from '../warehouses/warehouses.service.js';
import { publish } from '../realtime/realtime.bus.js';
import { afterStockChange } from '../operations/operations.service.js';

/*
 * Stock figures per product, scoped by $1 = warehouse id and $2 = location id (both nullable):
 *   onHand    = sum of quants in internal locations within the scope
 *   reserved  = qty on open (waiting/ready) delivery orders leaving the scope
 *   freeToUse = onHand - reserved
 *   minQty    = reorder-rule minimum (sum over the warehouses in scope)
 */
const STOCK_CTE = `
  WITH stock AS (
    SELECT q.product_id, sum(q.quantity) AS on_hand
      FROM stock_quants q JOIN locations l ON l.id = q.location_id
     WHERE l.type = 'internal'
       AND ($1::int IS NULL OR l.warehouse_id = $1)
       AND ($2::int IS NULL OR l.id = $2)
     GROUP BY q.product_id),
  reserved AS (
    SELECT ol.product_id, sum(ol.quantity) AS qty
      FROM operation_lines ol JOIN operations o ON o.id = ol.operation_id
     WHERE o.type = 'delivery' AND o.status IN ('waiting','ready')
       AND ($1::int IS NULL OR o.warehouse_id = $1 OR o.source_location_id IN (SELECT id FROM locations WHERE warehouse_id = $1))
       AND ($2::int IS NULL OR o.source_location_id = $2)
     GROUP BY ol.product_id),
  rules AS (
    SELECT product_id, sum(min_qty) AS min_qty FROM reorder_rules
     WHERE ($1::int IS NULL OR warehouse_id = $1)
       AND ($2::int IS NULL OR warehouse_id = (SELECT warehouse_id FROM locations WHERE id = $2))
     GROUP BY product_id)`;

const PRODUCT_COLS = `p.id, p.name, p.sku, p.uom, p.unit_cost AS "unitCost", p.category_id AS "categoryId",
  p.updated_at AS "updatedAt",
  c.name AS "categoryName",
  COALESCE(s.on_hand, 0) AS "onHand",
  COALESCE(s.on_hand, 0) - COALESCE(r.qty, 0) AS "freeToUse",
  ru.min_qty AS "minQty",
  CASE WHEN COALESCE(s.on_hand, 0) <= 0 THEN 'out'
       WHEN ru.min_qty IS NOT NULL AND COALESCE(s.on_hand, 0) <= ru.min_qty THEN 'low'
       ELSE 'in' END AS "stockStatus"`;

const PRODUCT_FROM = `FROM products p
  LEFT JOIN product_categories c ON c.id = p.category_id
  LEFT JOIN stock s     ON s.product_id = p.id
  LEFT JOIN reserved r  ON r.product_id = p.id
  LEFT JOIN rules ru    ON ru.product_id = p.id`;

export async function listProducts({ search, categoryId, warehouseId, locationId, stockStatus, page, pageSize }) {
  const scope = await resolveScope({ warehouseId, locationId });
  const params = [scope.warehouseId, scope.locationId];
  const where = ['p.is_active'];
  if (search) { params.push(`%${search}%`); where.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`); }
  if (categoryId) { params.push(categoryId); where.push(`p.category_id = $${params.length}`); }

  // stockStatus is derived, so filter on the computed column via a subquery.
  const inner = `${STOCK_CTE} SELECT ${PRODUCT_COLS} ${PRODUCT_FROM} WHERE ${where.join(' AND ')}`;
  const statusFilter = stockStatus ? `WHERE x."stockStatus" = '${stockStatus}'` : ''; // enum-validated

  const [{ rows }, count] = await Promise.all([
    query(`SELECT * FROM (${inner}) x ${statusFilter} ORDER BY x.name
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pageSize, (page - 1) * pageSize]),
    query(`SELECT count(*)::int AS total FROM (${inner}) x ${statusFilter}`, params),
  ]);
  return { rows, total: count.rows[0].total };
}

export async function getProduct(id) {
  const { rows } = await query(`${STOCK_CTE} SELECT ${PRODUCT_COLS} ${PRODUCT_FROM} WHERE p.id = $3`, [null, null, id]);
  if (!rows[0]) throw AppError.notFound('Product');

  const [locations, rules] = await Promise.all([
    query(
      `SELECT l.id AS "locationId", w.short_code || '/' || l.short_code AS "location", w.name AS "warehouseName",
              q.quantity
         FROM stock_quants q JOIN locations l ON l.id = q.location_id JOIN warehouses w ON w.id = l.warehouse_id
        WHERE q.product_id = $1 AND q.quantity > 0 ORDER BY w.name, l.name`, [id]),
    query(
      `SELECT r.id, r.warehouse_id AS "warehouseId", w.name AS "warehouseName", r.min_qty AS "minQty", r.max_qty AS "maxQty"
         FROM reorder_rules r JOIN warehouses w ON w.id = r.warehouse_id WHERE r.product_id = $1`, [id]),
  ]);
  return { ...rows[0], stockByLocation: locations.rows, reorderRules: rules.rows };
}

export async function createProduct(data, actor) {
  const id = await withTransaction(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO products (name, sku, category_id, uom, unit_cost) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [data.name, data.sku, data.categoryId ?? null, data.uom, data.unitCost],
    );
    const productId = rows[0].id;

    if (data.initialStock > 0) {
      const loc = await db.query(`SELECT warehouse_id FROM locations WHERE id = $1 AND type = 'internal'`, [data.initialLocationId]);
      if (!loc.rows[0]) throw AppError.badRequest('Invalid location', { initialLocationId: 'Choose a valid location' });
      await moveStock(db, {
        productId,
        fromLocationId: await virtualLocationId('inventory_loss', db),
        toLocationId: data.initialLocationId,
        quantity: data.initialStock,
        reference: await nextReference(db, loc.rows[0].warehouse_id, 'adjustment'),
        contact: 'Initial stock',
        userId: actor.id,
      });
      await afterStockChange(db, [productId], actor);
    }
    await publish(db, 'products', { id: productId, action: 'created' }, actor);
    return productId;
  });
  return getProduct(id);
}

export async function updateProduct(id, data, actor) {
  // Optimistic concurrency: only update if nobody saved since the client loaded it.
  // (JSON dates carry milliseconds; Postgres stores microseconds, hence date_trunc.)
  const { rowCount } = await query(
    `UPDATE products SET name=$1, sku=$2, category_id=$3, uom=$4, unit_cost=$5, updated_at=now()
      WHERE id=$6 AND ($7::timestamptz IS NULL OR date_trunc('milliseconds', updated_at) = $7::timestamptz)`,
    [data.name, data.sku, data.categoryId ?? null, data.uom, data.unitCost, id, data.expectedUpdatedAt ?? null],
  );
  if (!rowCount) {
    const exists = await query('SELECT 1 FROM products WHERE id = $1', [id]);
    if (!exists.rowCount) throw AppError.notFound('Product');
    throw AppError.conflict('Someone else changed this product while you were editing. Reload to see the latest version.');
  }
  await publish({ query }, 'products', { id, action: 'updated' }, actor);
  return getProduct(id);
}

export async function upsertReorderRule(productId, { warehouseId, minQty, maxQty }, actor) {
  await query(
    `INSERT INTO reorder_rules (product_id, warehouse_id, min_qty, max_qty) VALUES ($1,$2,$3,$4)
     ON CONFLICT (product_id, warehouse_id) DO UPDATE SET min_qty = EXCLUDED.min_qty, max_qty = EXCLUDED.max_qty`,
    [productId, warehouseId, minQty, maxQty],
  );
  await publish({ query }, 'products', { id: productId, action: 'rules' }, actor);
  return getProduct(productId);
}

export async function deleteReorderRule(productId, ruleId, actor) {
  await query('DELETE FROM reorder_rules WHERE id = $1 AND product_id = $2', [ruleId, productId]);
  await publish({ query }, 'products', { id: productId, action: 'rules' }, actor);
  return getProduct(productId);
}

// ---------------------------------------------------------------- categories
export async function listCategories() {
  const { rows } = await query(
    `SELECT c.id, c.name, count(p.id)::int AS "productCount"
       FROM product_categories c LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id ORDER BY c.name`,
  );
  return rows;
}

export async function createCategory({ name }, actor) {
  const { rows } = await query('INSERT INTO product_categories (name) VALUES ($1) RETURNING id, name', [name]);
  await publish({ query }, 'categories', { id: rows[0].id, action: 'created' }, actor);
  return rows[0];
}
