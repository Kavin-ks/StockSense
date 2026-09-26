import { query } from '../../db/pool.js';

/**
 * Dashboard snapshot. Optional filters narrow every KPI to one warehouse and/or product category.
 * All KPIs come from two aggregate queries, so the dashboard stays fast as data grows.
 */
export async function getSummary({ warehouseId, categoryId }) {
  const params = [warehouseId ?? null, categoryId ?? null];

  const stock = await query(
    `WITH per_product AS (
       SELECT p.id,
              COALESCE(sum(q.quantity) FILTER (WHERE l.type = 'internal' AND ($1::int IS NULL OR l.warehouse_id = $1)), 0) AS on_hand,
              (SELECT sum(min_qty) FROM reorder_rules r WHERE r.product_id = p.id AND ($1::int IS NULL OR r.warehouse_id = $1)) AS min_qty
         FROM products p
         LEFT JOIN stock_quants q ON q.product_id = p.id
         LEFT JOIN locations l ON l.id = q.location_id
        WHERE p.is_active AND ($2::int IS NULL OR p.category_id = $2)
        GROUP BY p.id)
     SELECT count(*) FILTER (WHERE on_hand > 0)::int                          AS "productsInStock",
            count(*) FILTER (WHERE on_hand > 0 AND on_hand <= min_qty)::int   AS "lowStock",
            count(*) FILTER (WHERE on_hand <= 0)::int                         AS "outOfStock",
            count(*)::int                                                     AS "totalProducts"
       FROM per_product`,
    params,
  );

  const ops = await query(
    `SELECT o.type,
            count(*) FILTER (WHERE o.status NOT IN ('done','canceled'))::int                                   AS pending,
            count(*) FILTER (WHERE o.status NOT IN ('done','canceled') AND o.scheduled_date < CURRENT_DATE)::int AS late,
            count(*) FILTER (WHERE o.status = 'waiting')::int                                                  AS waiting,
            count(*) FILTER (WHERE o.status = 'ready')::int                                                    AS ready,
            count(*) FILTER (WHERE o.status NOT IN ('done','canceled') AND o.scheduled_date >= CURRENT_DATE)::int AS upcoming
       FROM operations o
      WHERE ($1::int IS NULL OR o.warehouse_id = $1)
        AND ($2::int IS NULL OR EXISTS (SELECT 1 FROM operation_lines ol JOIN products p ON p.id = ol.product_id
                                         WHERE ol.operation_id = o.id AND p.category_id = $2))
      GROUP BY o.type`,
    params,
  );
  const byType = Object.fromEntries(ops.rows.map(({ type, ...counts }) => [type, counts]));
  const empty = { pending: 0, late: 0, waiting: 0, ready: 0, upcoming: 0 };

  return {
    ...stock.rows[0],
    receipts: { ...empty, ...byType.receipt },
    deliveries: { ...empty, ...byType.delivery },
    internal: { ...empty, ...byType.internal },
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
