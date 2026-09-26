/**
 * Insight reports computed from the ledger (stock_moves) and stock snapshot (stock_quants).
 * Everything is aggregated in SQL, so cost does not grow with what the browser receives.
 *
 * Direction of a move is derived from location types:
 *   in       = from a virtual location (vendor / adjustment) into an internal one
 *   out      = from an internal location to a virtual one (customer / adjustment loss)
 *   internal = between two internal locations (does not change total stock)
 */
import { query } from '../../db/pool.js';

const DIRECTION = `CASE WHEN fl.type <> 'internal' AND tl.type = 'internal' THEN 'in'
                        WHEN fl.type = 'internal' AND tl.type <> 'internal' THEN 'out'
                        ELSE 'internal' END`;

/** Daily in vs out quantities and value for the last `days` days (zero-filled). */
export async function movementSeries({ days, warehouseId }) {
  const { rows } = await query(
    `WITH d AS (SELECT generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, interval '1 day')::date AS day),
     m AS (
       SELECT m.created_at::date AS day, ${DIRECTION} AS dir, m.quantity, m.quantity * p.unit_cost AS value
         FROM stock_moves m
         JOIN products p ON p.id = m.product_id
         JOIN locations fl ON fl.id = m.from_location_id
         JOIN locations tl ON tl.id = m.to_location_id
        WHERE m.created_at >= CURRENT_DATE - ($1::int - 1)
          AND ($2::int IS NULL OR fl.warehouse_id = $2 OR tl.warehouse_id = $2))
     SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
            COALESCE(sum(m.quantity) FILTER (WHERE m.dir = 'in'), 0)  AS "inQty",
            COALESCE(sum(m.quantity) FILTER (WHERE m.dir = 'out'), 0) AS "outQty",
            COALESCE(sum(m.value) FILTER (WHERE m.dir = 'in'), 0)::numeric(14,2)  AS "inValue",
            COALESCE(sum(m.value) FILTER (WHERE m.dir = 'out'), 0)::numeric(14,2) AS "outValue"
       FROM d LEFT JOIN m ON m.day = d.day
      GROUP BY d.day ORDER BY d.day`,
    [days, warehouseId ?? null],
  );
  return rows;
}

/**
 * Recent activity: who did what, newest first. Built from what is already stored:
 * documents created (operations.created_by), packed (packed_by) and ledger postings (stock_moves.created_by).
 */
export async function activityFeed({ limit }) {
  const { rows } = await query(
    `SELECT * FROM (
       SELECT 'created' AS action, o.id AS "operationId", o.reference, o.type, o.created_at AS at, u.name AS "userName", NULL::int AS lines
         FROM operations o LEFT JOIN users u ON u.id = o.created_by
        WHERE o.type <> 'adjustment'
       UNION ALL
       SELECT 'packed', o.id, o.reference, o.type, o.packed_at, u.name, NULL
         FROM operations o LEFT JOIN users u ON u.id = o.packed_by
        WHERE o.packed_at IS NOT NULL
       UNION ALL
       SELECT CASE WHEN o.type = 'adjustment' THEN 'adjusted' ELSE 'validated' END,
              o.id, o.reference, o.type, max(m.created_at), max(u.name), count(DISTINCT m.product_id)::int
         FROM stock_moves m JOIN operations o ON o.id = m.operation_id
         LEFT JOIN users u ON u.id = m.created_by
        GROUP BY o.id
     ) a
     ORDER BY at DESC NULLS LAST
     LIMIT $1`,
    [limit],
  );
  return rows;
}

/**
 * Reorder suggestions: per reorder rule, on hand + already incoming (open receipts) vs the minimum.
 * Suggested quantity refills to the rule's maximum.
 */
export async function reorderSuggestions() {
  const { rows } = await query(
    `WITH on_hand AS (
       SELECT q.product_id, l.warehouse_id, sum(q.quantity) AS qty
         FROM stock_quants q JOIN locations l ON l.id = q.location_id
        WHERE l.type = 'internal' GROUP BY 1, 2),
     incoming AS (
       SELECT ol.product_id, o.warehouse_id, sum(ol.quantity) AS qty
         FROM operation_lines ol JOIN operations o ON o.id = ol.operation_id
        WHERE o.type = 'receipt' AND o.status IN ('draft','ready') GROUP BY 1, 2)
     SELECT p.id AS "productId", p.name, p.sku, p.uom, p.unit_cost AS "unitCost",
            w.id AS "warehouseId", w.name AS "warehouseName",
            r.min_qty AS "minQty", r.max_qty AS "maxQty",
            COALESCE(h.qty, 0) AS "onHand", COALESCE(i.qty, 0) AS "incoming",
            GREATEST(r.max_qty - COALESCE(h.qty, 0) - COALESCE(i.qty, 0), 0) AS "suggestedQty"
       FROM reorder_rules r
       JOIN products p ON p.id = r.product_id AND p.is_active
       JOIN warehouses w ON w.id = r.warehouse_id AND w.is_active
       LEFT JOIN on_hand h ON h.product_id = r.product_id AND h.warehouse_id = r.warehouse_id
       LEFT JOIN incoming i ON i.product_id = r.product_id AND i.warehouse_id = r.warehouse_id
      WHERE COALESCE(h.qty, 0) + COALESCE(i.qty, 0) <= r.min_qty
      ORDER BY (COALESCE(h.qty, 0) + COALESCE(i.qty, 0)) - r.min_qty, p.name`,
  );
  return rows;
}

/**
 * Per-product movement insight over a window:
 *  - top movers: most quantity shipped out
 *  - dead stock: in stock but nothing went out for `deadDays`
 *  - days of cover: on hand / average daily outgoing (null when nothing moves out)
 */
export async function stockInsights({ windowDays, deadDays }) {
  const { rows } = await query(
    `WITH on_hand AS (
       SELECT q.product_id, sum(q.quantity) AS qty
         FROM stock_quants q JOIN locations l ON l.id = q.location_id
        WHERE l.type = 'internal' GROUP BY 1),
     outgoing AS (
       SELECT m.product_id,
              sum(m.quantity) FILTER (WHERE m.created_at >= now() - make_interval(days => $1)) AS window_qty,
              max(m.created_at) AS last_out
         FROM stock_moves m
         JOIN locations fl ON fl.id = m.from_location_id
         JOIN locations tl ON tl.id = m.to_location_id
        WHERE fl.type = 'internal' AND tl.type = 'customer'
        GROUP BY 1)
     SELECT p.id, p.name, p.sku, p.uom, p.unit_cost AS "unitCost",
            COALESCE(h.qty, 0) AS "onHand",
            COALESCE(o.window_qty, 0) AS "outQty",
            o.last_out AS "lastOut",
            round(COALESCE(o.window_qty, 0) / $1::numeric, 3) AS "avgDailyOut",
            CASE WHEN COALESCE(o.window_qty, 0) > 0
                 THEN round(COALESCE(h.qty, 0) / (o.window_qty / $1::numeric), 1) END AS "daysOfCover",
            (COALESCE(h.qty, 0) > 0 AND (o.last_out IS NULL OR o.last_out < now() - make_interval(days => $2))) AS "isDead",
            (COALESCE(h.qty, 0) * p.unit_cost)::numeric(14,2) AS "stockValue"
       FROM products p
       LEFT JOIN on_hand h ON h.product_id = p.id
       LEFT JOIN outgoing o ON o.product_id = p.id
      WHERE p.is_active`,
    [windowDays, deadDays],
  );
  const byOut = [...rows].filter((r) => r.outQty > 0).sort((a, b) => b.outQty - a.outQty);
  return {
    windowDays,
    deadDays,
    topMovers: byOut.slice(0, 10),
    deadStock: rows.filter((r) => r.isDead).sort((a, b) => b.stockValue - a.stockValue),
    // Products that will run out first at the current pace.
    runningOut: rows.filter((r) => r.daysOfCover !== null).sort((a, b) => a.daysOfCover - b.daysOfCover).slice(0, 10),
  };
}

/**
 * Cycle-count schedule for warehouse staff: every internal location with stock, when it was last
 * counted (last adjustment posted there) and whether a count is due (never, or older than `everyDays`).
 */
export async function cycleCounts({ everyDays }) {
  const { rows } = await query(
    `WITH last_count AS (
       SELECT dest_location_id AS location_id, max(validated_at) AS at
         FROM operations WHERE type = 'adjustment' AND status = 'done' GROUP BY 1),
     stock AS (
       SELECT q.location_id, count(*) FILTER (WHERE q.quantity > 0)::int AS products,
              sum(q.quantity * p.unit_cost)::numeric(14,2) AS value
         FROM stock_quants q JOIN products p ON p.id = q.product_id GROUP BY 1)
     SELECT l.id AS "locationId", w.short_code || '/' || l.short_code AS "location", w.name AS "warehouseName",
            COALESCE(s.products, 0) AS products, COALESCE(s.value, 0) AS value,
            c.at AS "lastCountedAt",
            CASE WHEN c.at IS NULL THEN NULL ELSE (CURRENT_DATE - c.at::date) END AS "daysSince",
            (c.at IS NULL OR c.at < now() - make_interval(days => $1)) AS "isDue"
       FROM locations l
       JOIN warehouses w ON w.id = l.warehouse_id AND w.is_active
       LEFT JOIN stock s ON s.location_id = l.id
       LEFT JOIN last_count c ON c.location_id = l.id
      WHERE l.type = 'internal' AND l.is_active AND COALESCE(s.products, 0) > 0
      ORDER BY "isDue" DESC, c.at NULLS FIRST, w.name, l.name`,
    [everyDays],
  );
  return rows;
}
