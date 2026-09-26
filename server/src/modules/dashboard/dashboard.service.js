import { query } from '../../db/pool.js';
import { resolveScope } from '../warehouses/warehouses.service.js';

const TYPES = ['receipt', 'delivery', 'internal', 'adjustment'];
const STATUSES = ['draft', 'waiting', 'ready', 'done', 'canceled'];
const OPEN = new Set(['draft', 'waiting', 'ready']);

/**
 * Dashboard snapshot. Every figure respects the scope filters:
 *   $1 warehouse, $2 product category, $3 location (all optional).
 * Two aggregate queries regardless of data size; the rest is shaping in JS.
 */
export async function getSummary({ warehouseId, locationId, categoryId }) {
  const scope = await resolveScope({ warehouseId, locationId });
  const params = [scope.warehouseId, categoryId ?? null, scope.locationId];

  const stock = await query(
    `WITH per_product AS (
       SELECT p.id,
              COALESCE(sum(q.quantity) FILTER (
                WHERE l.type = 'internal'
                  AND ($1::int IS NULL OR l.warehouse_id = $1)
                  AND ($3::int IS NULL OR l.id = $3)), 0) AS on_hand,
              (SELECT sum(min_qty) FROM reorder_rules r
                WHERE r.product_id = p.id
                  AND ($1::int IS NULL OR r.warehouse_id = $1)
                  AND ($3::int IS NULL OR r.warehouse_id = (SELECT warehouse_id FROM locations WHERE id = $3))) AS min_qty
         FROM products p
         LEFT JOIN stock_quants q ON q.product_id = p.id
         LEFT JOIN locations l ON l.id = q.location_id
        WHERE p.is_active AND ($2::int IS NULL OR p.category_id = $2)
        GROUP BY p.id)
     SELECT count(*) FILTER (WHERE on_hand > 0)::int                        AS "productsInStock",
            count(*) FILTER (WHERE on_hand > 0 AND on_hand <= min_qty)::int AS "lowStock",
            count(*) FILTER (WHERE on_hand <= 0)::int                       AS "outOfStock",
            count(*)::int                                                   AS "totalProducts"
       FROM per_product`,
    params,
  );

  // One row per (type, status) — feeds both the KPI cards and the type x status breakdown.
  const ops = await query(
    `SELECT o.type, o.status,
            count(*)::int                                                  AS total,
            count(*) FILTER (WHERE o.scheduled_date <  CURRENT_DATE)::int  AS overdue,
            count(*) FILTER (WHERE o.scheduled_date >= CURRENT_DATE)::int  AS upcoming
       FROM operations o
      WHERE ($1::int IS NULL OR o.warehouse_id = $1
             OR EXISTS (SELECT 1 FROM locations x
                         WHERE x.id IN (o.source_location_id, o.dest_location_id) AND x.warehouse_id = $1))
        AND ($3::int IS NULL OR o.source_location_id = $3 OR o.dest_location_id = $3)
        AND ($2::int IS NULL OR EXISTS (SELECT 1 FROM operation_lines ol JOIN products p ON p.id = ol.product_id
                                         WHERE ol.operation_id = o.id AND p.category_id = $2))
      GROUP BY o.type, o.status`,
    params,
  );

  const breakdown = Object.fromEntries(TYPES.map((t) => [t, Object.fromEntries(STATUSES.map((st) => [st, 0]))]));
  const cards = Object.fromEntries(TYPES.map((t) => [t, { pending: 0, late: 0, waiting: 0, ready: 0, upcoming: 0 }]));
  for (const r of ops.rows) {
    breakdown[r.type][r.status] = r.total;
    if (!OPEN.has(r.status)) continue;
    const c = cards[r.type];
    c.pending += r.total;
    c.late += r.overdue;      // late = scheduled before today and still open
    c.upcoming += r.upcoming;
    if (r.status === 'waiting') c.waiting += r.total;
    if (r.status === 'ready') c.ready += r.total;
  }

  return {
    ...stock.rows[0],
    receipts: cards.receipt,
    deliveries: cards.delivery,
    internal: cards.internal,
    breakdown,
  };
}

/** Products at/below their reorder minimum or out of stock — feeds the alert bell. */
export async function getLowStockAlerts() {
  const { rows } = await query(
    `SELECT p.id, p.name, p.sku, p.uom, w.name AS "warehouseName", r.min_qty AS "minQty",
            COALESCE(sum(q.quantity), 0) AS "onHand"
       FROM reorder_rules r
       JOIN products p   ON p.id = r.product_id AND p.is_active
       JOIN warehouses w ON w.id = r.warehouse_id
       LEFT JOIN locations l    ON l.warehouse_id = w.id AND l.type = 'internal'
       LEFT JOIN stock_quants q ON q.location_id = l.id AND q.product_id = p.id
      GROUP BY p.id, w.id, r.min_qty
     HAVING COALESCE(sum(q.quantity), 0) <= r.min_qty
      ORDER BY COALESCE(sum(q.quantity), 0) - r.min_qty, p.name
      LIMIT 50`,
  );
  return rows;
}
