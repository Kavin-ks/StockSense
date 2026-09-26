/**
 * Operations = stock documents (receipts, deliveries, internal transfers, adjustments).
 *
 * Status machine
 *   receipt / internal : draft -> ready -> done           (cancel from any non-done state)
 *   delivery           : draft -> waiting|ready -> done   (waiting = not enough stock yet)
 *   adjustment         : created directly as done (counted qty is applied immediately)
 *
 * Stock only changes on `validate`, through the stock engine, inside one transaction.
 */
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { moveStock, nextReference, onHand } from '../stock/stock.service.js';
import { defaultLocationId, resolveScope, virtualLocationId } from '../warehouses/warehouses.service.js';

const OP_COLS = `o.id, o.reference, o.type, o.status, o.warehouse_id AS "warehouseId", w.name AS "warehouseName",
  o.source_location_id AS "sourceLocationId", o.dest_location_id AS "destLocationId",
  COALESCE(sw.short_code || '/' || sl.short_code, sl.name) AS "sourceLocation",
  COALESCE(dw.short_code || '/' || dl.short_code, dl.name) AS "destLocation",
  o.contact, o.delivery_address AS "deliveryAddress", o.scheduled_date AS "scheduledDate",
  o.responsible_id AS "responsibleId", u.name AS "responsibleName", o.notes,
  o.validated_at AS "validatedAt", o.created_at AS "createdAt",
  (o.scheduled_date < CURRENT_DATE AND o.status NOT IN ('done','canceled')) AS "isLate"`;

const OP_FROM = `FROM operations o
  JOIN warehouses w ON w.id = o.warehouse_id
  JOIN locations sl ON sl.id = o.source_location_id LEFT JOIN warehouses sw ON sw.id = sl.warehouse_id
  JOIN locations dl ON dl.id = o.dest_location_id   LEFT JOIN warehouses dw ON dw.id = dl.warehouse_id
  LEFT JOIN users u ON u.id = o.responsible_id`;

// ------------------------------------------------------------------ queries

export async function listOperations(filters) {
  const f = { ...filters, ...(await resolveScope(filters)) };
  const where = [];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };

  if (f.type) add('o.type = ?', f.type);
  if (f.status) add('o.status = ?', f.status);
  // Include transfers into/out of this warehouse even when the document belongs to another one.
  if (f.warehouseId) add('(o.warehouse_id = ? OR sl.warehouse_id = ? OR dl.warehouse_id = ?)', f.warehouseId);
  if (f.locationId) add('(o.source_location_id = ? OR o.dest_location_id = ?)', f.locationId);
  if (f.search) add('(o.reference ILIKE ? OR o.contact ILIKE ?)', `%${f.search}%`);
  if (f.categoryId) add(`EXISTS (SELECT 1 FROM operation_lines ol JOIN products p ON p.id = ol.product_id
                                  WHERE ol.operation_id = o.id AND p.category_id = ?)`, f.categoryId);
  if (f.late) where.push(`o.scheduled_date < CURRENT_DATE AND o.status NOT IN ('done','canceled')`);
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const [{ rows }, count] = await Promise.all([
    query(`SELECT ${OP_COLS} ${OP_FROM} ${whereSql}
           ORDER BY o.scheduled_date DESC, o.id DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, f.pageSize, (f.page - 1) * f.pageSize]),
    query(`SELECT count(*)::int AS total ${OP_FROM} ${whereSql}`, params),
  ]);
  return { rows, total: count.rows[0].total };
}

export async function getOperation(id, db = { query }) {
  const { rows } = await db.query(`SELECT ${OP_COLS} ${OP_FROM} WHERE o.id = $1`, [id]);
  if (!rows[0]) throw AppError.notFound('Operation');
  const op = rows[0];

  // For outgoing docs, show availability at the source so the UI can flag short lines in red.
  const { rows: lines } = await db.query(
    `SELECT ol.id, ol.product_id AS "productId", p.name AS "productName", p.sku, p.uom,
            ol.quantity, ol.counted_qty AS "countedQty",
            COALESCE(q.quantity, 0) AS "available"
       FROM operation_lines ol
       JOIN products p ON p.id = ol.product_id
       LEFT JOIN stock_quants q ON q.product_id = ol.product_id AND q.location_id = $2
      WHERE ol.operation_id = $1 ORDER BY ol.id`,
    [id, op.sourceLocationId],
  );
  op.lines = lines.map((l) => ({ ...l, inStock: l.available >= l.quantity }));
  return op;
}

// ------------------------------------------------------------------ commands

async function resolveLocations(db, d) {
  switch (d.type) {
    case 'receipt':
      return [await virtualLocationId('vendor', db), d.destLocationId ?? await defaultLocationId(d.warehouseId, db)];
    case 'delivery':
      return [d.sourceLocationId ?? await defaultLocationId(d.warehouseId, db), await virtualLocationId('customer', db)];
    default:
      return [d.sourceLocationId, d.destLocationId];
  }
}

/** Internal locations used by an operation must belong to its warehouse (transfers may target any warehouse). */
async function assertLocations(db, d, src, dst) {
  const { rows } = await db.query(`SELECT id, type, warehouse_id FROM locations WHERE id = ANY($1)`, [[src, dst]]);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  const check = (id, field, mustBeInWarehouse) => {
    const loc = byId[id];
    if (!loc) throw AppError.badRequest('Invalid location', { [field]: 'Location not found' });
    if (mustBeInWarehouse && loc.type === 'internal' && loc.warehouse_id !== d.warehouseId) {
      throw AppError.badRequest('Location belongs to another warehouse', { [field]: 'Location belongs to another warehouse' });
    }
  };
  check(src, 'sourceLocationId', true);
  check(dst, 'destLocationId', d.type !== 'internal');
}

async function writeLines(db, operationId, lines) {
  await db.query('DELETE FROM operation_lines WHERE operation_id = $1', [operationId]);
  for (const l of lines) {
    await db.query('INSERT INTO operation_lines (operation_id, product_id, quantity) VALUES ($1,$2,$3)',
      [operationId, l.productId, l.quantity]);
  }
}

export async function createOperation(d, userId) {
  return withTransaction(async (db) => {
    const [src, dst] = await resolveLocations(db, d);
    await assertLocations(db, d, src, dst);
    const reference = await nextReference(db, d.warehouseId, d.type);
    const { rows } = await db.query(
      `INSERT INTO operations (reference, type, warehouse_id, source_location_id, dest_location_id, contact,
                               delivery_address, scheduled_date, responsible_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [reference, d.type, d.warehouseId, src, dst, d.contact || null, d.deliveryAddress || null,
        d.scheduledDate, d.responsibleId ?? userId, d.notes || null, userId],
    );
    await writeLines(db, rows[0].id, d.lines);
    return getOperation(rows[0].id, db);
  });
}

async function lockOperation(db, id) {
  const { rows } = await db.query('SELECT * FROM operations WHERE id = $1 FOR UPDATE', [id]);
  if (!rows[0]) throw AppError.notFound('Operation');
  return rows[0];
}

export async function updateOperation(id, d) {
  return withTransaction(async (db) => {
    const op = await lockOperation(db, id);
    if (['done', 'canceled'].includes(op.status)) throw AppError.conflict(`A ${op.status} operation cannot be edited`);
    if (op.type !== d.type || op.warehouse_id !== d.warehouseId) {
      throw AppError.badRequest('Type and warehouse cannot be changed after creation');
    }
    const [src, dst] = await resolveLocations(db, d);
    await assertLocations(db, d, src, dst);
    await db.query(
      `UPDATE operations SET source_location_id=$1, dest_location_id=$2, contact=$3, delivery_address=$4,
              scheduled_date=$5, responsible_id=$6, notes=$7, updated_at=now() WHERE id=$8`,
      [src, dst, d.contact || null, d.deliveryAddress || null, d.scheduledDate, d.responsibleId ?? op.responsible_id, d.notes || null, id],
    );
    await writeLines(db, id, d.lines);
    // Editing a confirmed delivery re-checks availability.
    if (op.type === 'delivery' && op.status !== 'draft') await refreshDeliveryStatus(db, id);
    return getOperation(id, db);
  });
}

async function allLinesAvailable(db, op) {
  const { rows } = await db.query('SELECT product_id, quantity FROM operation_lines WHERE operation_id = $1', [op.id]);
  for (const l of rows) {
    if ((await onHand(db, l.product_id, op.source_location_id)) < l.quantity) return false;
  }
  return true;
}

async function refreshDeliveryStatus(db, id) {
  const op = await lockOperation(db, id);
  const status = (await allLinesAvailable(db, op)) ? 'ready' : 'waiting';
  await db.query('UPDATE operations SET status=$1, updated_at=now() WHERE id=$2', [status, id]);
}

/** "To Do" button: draft -> ready (deliveries go to waiting if stock is short). */
export async function confirmOperation(id) {
  return withTransaction(async (db) => {
    const op = await lockOperation(db, id);
    if (op.status !== 'draft') throw AppError.conflict('Only draft operations can be confirmed');
    if (op.type === 'delivery') await refreshDeliveryStatus(db, id);
    else await db.query(`UPDATE operations SET status='ready', updated_at=now() WHERE id=$1`, [id]);
    return getOperation(id, db);
  });
}

/** "Validate" button: apply every line through the stock engine and mark done. */
export async function validateOperation(id, userId) {
  return withTransaction(async (db) => {
    const op = await lockOperation(db, id);
    if (!['ready', 'waiting'].includes(op.status)) {
      throw AppError.conflict(op.status === 'draft' ? 'Mark the operation as To Do first' : `Operation is already ${op.status}`);
    }
    const { rows: lines } = await db.query('SELECT product_id, quantity FROM operation_lines WHERE operation_id = $1', [id]);
    if (!lines.length) throw AppError.badRequest('Add at least one product');

    for (const l of lines) {
      await moveStock(db, {
        productId: l.product_id,
        fromLocationId: op.source_location_id,
        toLocationId: op.dest_location_id,
        quantity: l.quantity,
        reference: op.reference,
        operationId: op.id,
        contact: op.contact,
        userId,
      });
    }
    await db.query(`UPDATE operations SET status='done', validated_at=now(), updated_at=now() WHERE id=$1`, [id]);
    return getOperation(id, db);
  });
}

export async function cancelOperation(id) {
  return withTransaction(async (db) => {
    const op = await lockOperation(db, id);
    if (['done', 'canceled'].includes(op.status)) throw AppError.conflict(`Operation is already ${op.status}`);
    await db.query(`UPDATE operations SET status='canceled', updated_at=now() WHERE id=$1`, [id]);
    return getOperation(id, db);
  });
}

/**
 * Inventory adjustment: user enters the physically counted qty per product,
 * the system posts the difference against the virtual "Inventory adjustment" location.
 */
export async function createAdjustment({ locationId, notes, lines }, userId) {
  return withTransaction(async (db) => {
    const { rows: loc } = await db.query(`SELECT warehouse_id FROM locations WHERE id=$1 AND type='internal'`, [locationId]);
    if (!loc[0]) throw AppError.badRequest('Invalid location', { locationId: 'Choose a valid location' });
    const adjLoc = await virtualLocationId('inventory_loss', db);
    const reference = await nextReference(db, loc[0].warehouse_id, 'adjustment');

    const { rows } = await db.query(
      `INSERT INTO operations (reference, type, status, warehouse_id, source_location_id, dest_location_id,
                               contact, notes, responsible_id, created_by, validated_at)
       VALUES ($1,'adjustment','done',$2,$3,$4,'Inventory adjustment',$5,$6,$6,now()) RETURNING id`,
      [reference, loc[0].warehouse_id, adjLoc, locationId, notes || null, userId],
    );
    const opId = rows[0].id;

    for (const l of lines) {
      const recorded = await onHand(db, l.productId, locationId);
      const diff = l.countedQty - recorded;
      await db.query(
        'INSERT INTO operation_lines (operation_id, product_id, quantity, counted_qty) VALUES ($1,$2,$3,$4)',
        [opId, l.productId, Math.abs(diff), l.countedQty],
      );
      if (diff === 0) continue;
      await moveStock(db, {
        productId: l.productId,
        fromLocationId: diff > 0 ? adjLoc : locationId,
        toLocationId: diff > 0 ? locationId : adjLoc,
        quantity: Math.abs(diff),
        reference,
        operationId: opId,
        contact: 'Inventory adjustment',
        userId,
      });
    }
    return getOperation(opId, db);
  });
}
