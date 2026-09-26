/**
 * Stock engine — the single place that changes stock.
 *
 * Every business flow (receipt, delivery, transfer, adjustment, initial stock)
 * is expressed as `moveStock(from, to, qty)`. This function:
 *   1. decrements the source quant (if the source is a real/internal location),
 *   2. increments the destination quant (if the destination is internal),
 *   3. appends an immutable row to the stock_moves ledger,
 * all on the caller's transaction client, so the three can never diverge.
 */
import { query } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';

const REF_CODES = { receipt: 'IN', delivery: 'OUT', internal: 'INT', adjustment: 'ADJ' };

async function locationType(db, id) {
  const { rows } = await db.query('SELECT type FROM locations WHERE id = $1', [id]);
  if (!rows[0]) throw AppError.notFound('Location');
  return rows[0].type;
}

export async function moveStock(db, { productId, fromLocationId, toLocationId, quantity, reference, operationId = null, contact = null, userId = null }) {
  if (!(quantity > 0)) return;
  const [fromType, toType] = await Promise.all([locationType(db, fromLocationId), locationType(db, toLocationId)]);

  if (fromType === 'internal') {
    // Conditional update = atomic check-and-decrement, safe under concurrency.
    const { rowCount } = await db.query(
      `UPDATE stock_quants SET quantity = quantity - $3, updated_at = now()
        WHERE product_id = $1 AND location_id = $2 AND quantity >= $3`,
      [productId, fromLocationId, quantity],
    );
    if (!rowCount) {
      const { rows } = await db.query('SELECT name, sku FROM products WHERE id = $1', [productId]);
      throw AppError.conflict(`Not enough stock of [${rows[0]?.sku}] ${rows[0]?.name} at the source location`);
    }
  }

  if (toType === 'internal') {
    await db.query(
      `INSERT INTO stock_quants (product_id, location_id, quantity) VALUES ($1,$2,$3)
       ON CONFLICT (product_id, location_id)
       DO UPDATE SET quantity = stock_quants.quantity + EXCLUDED.quantity, updated_at = now()`,
      [productId, toLocationId, quantity],
    );
  }

  await db.query(
    `INSERT INTO stock_moves (operation_id, reference, product_id, from_location_id, to_location_id, quantity, contact, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [operationId, reference, productId, fromLocationId, toLocationId, quantity, contact, userId],
  );
}

/** Next reference like "WH/IN/0001" — row-locked counter per warehouse and type. */
export async function nextReference(db, warehouseId, type) {
  const { rows } = await db.query(
    `WITH seq AS (
       INSERT INTO operation_sequences (warehouse_id, type, next_value) VALUES ($1, $2, 2)
       ON CONFLICT (warehouse_id, type) DO UPDATE SET next_value = operation_sequences.next_value + 1
       RETURNING next_value - 1 AS value)
     SELECT w.short_code, seq.value FROM seq, warehouses w WHERE w.id = $1`,
    [warehouseId, type],
  );
  if (!rows[0]) throw AppError.notFound('Warehouse');
  return `${rows[0].short_code}/${REF_CODES[type]}/${String(rows[0].value).padStart(4, '0')}`;
}

/** Quantity on hand for a product at one location. */
export async function onHand(db, productId, locationId) {
  const { rows } = await db.query(
    'SELECT quantity FROM stock_quants WHERE product_id = $1 AND location_id = $2',
    [productId, locationId],
  );
  return rows[0]?.quantity ?? 0;
}

// ------------------------------------------------------------------ move history (ledger)

export async function listMoves({ search, productId, warehouseId, locationId, categoryId, type, direction, from, to, page, pageSize }) {
  const where = [];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };

  if (search) add('(m.reference ILIKE ? OR m.contact ILIKE ? OR p.name ILIKE ? OR p.sku ILIKE ?)', `%${search}%`);
  if (productId) add('m.product_id = ?', productId);
  if (warehouseId) add('(fl.warehouse_id = ? OR tl.warehouse_id = ?)', warehouseId);
  if (locationId) add('(m.from_location_id = ? OR m.to_location_id = ?)', locationId);
  if (categoryId) add('p.category_id = ?', categoryId);
  // Document type is encoded in the reference (WH/IN/0001); this also covers initial-stock adjustments.
  if (type) add(`split_part(m.reference, '/', 2) = ?`, REF_CODES[type]);
  if (from) add('m.created_at >= ?::date', from);
  if (to) add(`m.created_at < ?::date + 1`, to);
  if (direction === 'in') where.push(`fl.type <> 'internal' AND tl.type = 'internal'`);
  if (direction === 'out') where.push(`fl.type = 'internal' AND tl.type <> 'internal'`);
  if (direction === 'internal') where.push(`fl.type = 'internal' AND tl.type = 'internal'`);

  const base = `FROM stock_moves m
    JOIN products p   ON p.id = m.product_id
    JOIN locations fl ON fl.id = m.from_location_id
    JOIN locations tl ON tl.id = m.to_location_id
    LEFT JOIN warehouses fw ON fw.id = fl.warehouse_id
    LEFT JOIN warehouses tw ON tw.id = tl.warehouse_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;

  const [{ rows }, count] = await Promise.all([
    query(
      `SELECT m.id, m.reference, m.operation_id AS "operationId", m.quantity, m.contact, m.created_at AS "date",
              p.id AS "productId", p.name AS "productName", p.sku, p.uom,
              COALESCE(fw.short_code || '/' || fl.short_code, fl.name) AS "from",
              COALESCE(tw.short_code || '/' || tl.short_code, tl.name) AS "to",
              CASE WHEN fl.type <> 'internal' AND tl.type = 'internal' THEN 'in'
                   WHEN fl.type = 'internal' AND tl.type <> 'internal' THEN 'out'
                   ELSE 'internal' END AS direction
         ${base}
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize],
    ),
    query(`SELECT count(*)::int AS total ${base}`, params),
  ]);
  return { rows, total: count.rows[0].total };
}
