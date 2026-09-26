import { can } from '../../config/permissions.js';
/**
 * Operations = stock documents (receipts, deliveries, internal transfers, adjustments).
 *
 * Status machine
 *   receipt / internal : draft -> ready -> done           (cancel from any non-done state)
 *   delivery           : draft -> waiting|ready -> [pick -> pack] -> done   (waiting = not enough stock yet)
 *   adjustment         : created directly as done (counted qty is applied immediately)
 *
 * Stock only changes on `validate`, through the stock engine, inside one transaction.
 */
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { moveStock, nextReference, onHand } from '../stock/stock.service.js';
import { defaultLocationId, resolveScope, virtualLocationId } from '../warehouses/warehouses.service.js';
import { publish } from '../realtime/realtime.bus.js';

/** Notify every connected client (delivered on COMMIT) that this document changed. */
async function publishOperation(db, id, action, actor) {
  const { rows } = await db.query('SELECT id, reference, type, status FROM operations WHERE id = $1', [id]);
  await publish(db, 'operations', { action, ...rows[0] }, actor);
}

const OP_COLS = `o.id, o.reference, o.type, o.status, o.warehouse_id AS "warehouseId", w.name AS "warehouseName",
  o.source_location_id AS "sourceLocationId", o.dest_location_id AS "destLocationId",
  COALESCE(sw.short_code || '/' || sl.short_code, sl.name) AS "sourceLocation",
  COALESCE(dw.short_code || '/' || dl.short_code, dl.name) AS "destLocation",
  o.contact, o.delivery_address AS "deliveryAddress", o.scheduled_date AS "scheduledDate",
  o.responsible_id AS "responsibleId", u.name AS "responsibleName", o.notes,
  o.validated_at AS "validatedAt", o.created_at AS "createdAt", o.updated_at AS "updatedAt",
  o.packed_at AS "packedAt", pk.name AS "packedByName",
  (o.scheduled_date < CURRENT_DATE AND o.status NOT IN ('done','canceled')) AS "isLate"`;

const OP_FROM = `FROM operations o
  JOIN warehouses w ON w.id = o.warehouse_id
  JOIN locations sl ON sl.id = o.source_location_id LEFT JOIN warehouses sw ON sw.id = sl.warehouse_id
  JOIN locations dl ON dl.id = o.dest_location_id   LEFT JOIN warehouses dw ON dw.id = dl.warehouse_id
  LEFT JOIN users u ON u.id = o.responsible_id
  LEFT JOIN users pk ON pk.id = o.packed_by`;

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
            ol.quantity, ol.counted_qty AS "countedQty", ol.picked_qty AS "pickedQty",
            COALESCE(q.quantity, 0) AS "available",
            -- Signed change actually posted to the ledger (adjustments: +found / -lost).
            (SELECT sum(CASE WHEN tl.type = 'internal' THEN m.quantity ELSE -m.quantity END)
               FROM stock_moves m JOIN locations tl ON tl.id = m.to_location_id
              WHERE m.operation_id = ol.operation_id AND m.product_id = ol.product_id) AS "delta"
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
  const { rows } = await db.query(
    `SELECT l.id, l.type, l.warehouse_id, l.is_active AND COALESCE(w.is_active, true) AS usable
       FROM locations l LEFT JOIN warehouses w ON w.id = l.warehouse_id WHERE l.id = ANY($1)`,
    [[src, dst]],
  );
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  const check = (id, field, mustBeInWarehouse) => {
    const loc = byId[id];
    if (!loc) throw AppError.badRequest('Invalid location', { [field]: 'Location not found' });
    if (!loc.usable) throw AppError.badRequest('Location is archived', { [field]: 'This location (or its warehouse) is archived' });
    if (mustBeInWarehouse && loc.type === 'internal' && loc.warehouse_id !== d.warehouseId) {
      throw AppError.badRequest('Location belongs to another warehouse', { [field]: 'Location belongs to another warehouse' });
    }
  };
  check(src, 'sourceLocationId', true);
  check(dst, 'destLocationId', d.type !== 'internal');
}

/** Archived products cannot be put on new or edited documents. */
async function assertActiveProducts(db, productIds) {
  const { rows } = await db.query('SELECT sku FROM products WHERE id = ANY($1) AND NOT is_active', [productIds]);
  if (rows.length) {
    throw AppError.badRequest(`Archived product(s) cannot be used: ${rows.map((r) => r.sku).join(', ')}`, { lines: 'Remove archived products' });
  }
}

async function writeLines(db, operationId, lines) {
  await assertActiveProducts(db, lines.map((l) => l.productId));
  // Lines are rewritten, so any picking progress on a delivery starts over.
  await db.query('DELETE FROM operation_lines WHERE operation_id = $1', [operationId]);
  for (const l of lines) {
    await db.query('INSERT INTO operation_lines (operation_id, product_id, quantity) VALUES ($1,$2,$3)',
      [operationId, l.productId, l.quantity]);
  }
}

export async function createOperation(d, actor) {
  return withTransaction(async (db) => {
    const [src, dst] = await resolveLocations(db, d);
    await assertLocations(db, d, src, dst);
    const reference = await nextReference(db, d.warehouseId, d.type);
    const { rows } = await db.query(
      `INSERT INTO operations (reference, type, warehouse_id, source_location_id, dest_location_id, contact,
                               delivery_address, scheduled_date, responsible_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [reference, d.type, d.warehouseId, src, dst, d.contact || null, d.deliveryAddress || null,
        d.scheduledDate, d.responsibleId ?? actor.id, d.notes || null, actor.id],
    );
    await writeLines(db, rows[0].id, d.lines);
    await publishOperation(db, rows[0].id, 'created', actor);
    return getOperation(rows[0].id, db);
  });
}

/**
 * Optimistic concurrency: the client sends the updatedAt it loaded. If someone else
 * saved in between, refuse instead of silently overwriting their work.
 */
function assertNotStale(op, expectedUpdatedAt) {
  if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== op.updated_at.getTime()) {
    throw AppError.conflict('Someone else changed this document while you were editing. Reload to see the latest version.');
  }
}

export async function getOperationType(id) {
  const { rows } = await query('SELECT type FROM operations WHERE id = $1', [id]);
  if (!rows[0]) throw AppError.notFound('Operation');
  return rows[0].type;
}

async function lockOperation(db, id) {
  const { rows } = await db.query('SELECT * FROM operations WHERE id = $1 FOR UPDATE', [id]);
  if (!rows[0]) throw AppError.notFound('Operation');
  return rows[0];
}

export async function updateOperation(id, d, actor) {
  return withTransaction(async (db) => {
    const op = await lockOperation(db, id);
    if (['done', 'canceled'].includes(op.status)) throw AppError.conflict(`A ${op.status} operation cannot be edited`);
    assertNotStale(op, d.expectedUpdatedAt);
    if (op.type !== d.type || op.warehouse_id !== d.warehouseId) {
      throw AppError.badRequest('Type and warehouse cannot be changed after creation');
    }
    const [src, dst] = await resolveLocations(db, d);
    await assertLocations(db, d, src, dst);
    await db.query(
      `UPDATE operations SET source_location_id=$1, dest_location_id=$2, contact=$3, delivery_address=$4,
              scheduled_date=$5, responsible_id=$6, notes=$7, packed_at=NULL, packed_by=NULL, updated_at=now() WHERE id=$8`,
      [src, dst, d.contact || null, d.deliveryAddress || null, d.scheduledDate, d.responsibleId ?? op.responsible_id, d.notes || null, id],
    );
    await writeLines(db, id, d.lines);
    // Editing a confirmed delivery re-checks availability.
    if (op.type === 'delivery' && op.status !== 'draft') await refreshDeliveryStatus(db, id);
    await publishOperation(db, id, 'updated', actor);
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

/** Move a delivery to waiting (stock short) or ready. Going back to waiting undoes picking/packing. */
async function setDeliveryAvailability(db, op) {
  const status = (await allLinesAvailable(db, op)) ? 'ready' : 'waiting';
  if (status === 'waiting') {
    await db.query('UPDATE operations SET packed_at = NULL, packed_by = NULL WHERE id = $1', [op.id]);
    await db.query('UPDATE operation_lines SET picked_qty = NULL WHERE operation_id = $1', [op.id]);
  }
  await db.query('UPDATE operations SET status=$1, updated_at=now() WHERE id=$2', [status, op.id]);
  return status;
}

async function refreshDeliveryStatus(db, id) {
  return setDeliveryAvailability(db, await lockOperation(db, id));
}

/** "To Do" button: draft -> ready (deliveries go to waiting if stock is short). */
export async function confirmOperation(id, actor) {
  return withTransaction(async (db) => {
    const op = await lockOperation(db, id);
    if (op.status !== 'draft') throw AppError.conflict('Only draft operations can be confirmed');
    if (op.type === 'delivery') await refreshDeliveryStatus(db, id);
    else await db.query(`UPDATE operations SET status='ready', updated_at=now() WHERE id=$1`, [id]);
    await publishOperation(db, id, 'confirmed', actor);
    return getOperation(id, db);
  });
}

/** "Validate" button: apply every line through the stock engine and mark done. */
export async function validateOperation(id, actor) {
  return withTransaction(async (db) => {
    const op = await lockOperation(db, id);
    if (op.status === 'waiting') throw AppError.conflict('Some products are not in stock yet. Use "Check availability" once stock arrives.');
    if (op.status !== 'ready') {
      throw AppError.conflict(op.status === 'draft' ? 'Mark the operation as To Do first' : `Operation is already ${op.status}`);
    }
    // Problem statement: deliveries are picked, then packed, then validated.
    if (op.type === 'delivery' && !op.packed_at) throw AppError.conflict('Pick and pack the items before validating the delivery');
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
        userId: actor.id,
      });
    }
    await db.query(`UPDATE operations SET status='done', validated_at=now(), updated_at=now() WHERE id=$1`, [id]);
    await publishOperation(db, id, 'validated', actor);
    await afterStockChange(db, lines.map((l) => l.product_id), actor);
    return getOperation(id, db);
  });
}

// ------------------------------------------------------------------ delivery: pick -> pack

async function lockReadyDelivery(db, id) {
  const op = await lockOperation(db, id);
  if (op.type !== 'delivery') throw AppError.badRequest('Only deliveries are picked and packed');
  if (op.status !== 'ready') throw AppError.conflict(op.status === 'waiting' ? 'Wait until all products are in stock' : `Delivery is ${op.status}`);
  return op;
}

/** Record picked quantities per line (0..ordered). Changing picks after packing unpacks the order. */
export async function pickDelivery(id, { lines }, actor) {
  return withTransaction(async (db) => {
    const op = await lockReadyDelivery(db, id);
    const { rows: current } = await db.query('SELECT id, quantity FROM operation_lines WHERE operation_id = $1', [id]);
    const byId = new Map(current.map((l) => [l.id, l]));
    for (const l of lines) {
      const line = byId.get(l.lineId);
      if (!line) throw AppError.badRequest('Unknown line', { lines: 'A line does not belong to this delivery' });
      if (l.pickedQty > line.quantity) throw AppError.badRequest('Cannot pick more than ordered', { lines: `Picked quantity cannot exceed ${line.quantity}` });
      await db.query('UPDATE operation_lines SET picked_qty = $1 WHERE id = $2', [l.pickedQty, l.lineId]);
    }
    if (op.packed_at) await db.query('UPDATE operations SET packed_at = NULL, packed_by = NULL WHERE id = $1', [id]);
    await db.query('UPDATE operations SET updated_at = now() WHERE id = $1', [id]);
    await publishOperation(db, id, 'picked', actor);
    return getOperation(id, db);
  });
}

/** Mark packed once every line is fully picked. */
export async function packDelivery(id, actor) {
  return withTransaction(async (db) => {
    await lockReadyDelivery(db, id);
    const { rows } = await db.query(
      `SELECT p.sku, ol.quantity, COALESCE(ol.picked_qty, 0) AS picked
         FROM operation_lines ol JOIN products p ON p.id = ol.product_id
        WHERE ol.operation_id = $1 AND COALESCE(ol.picked_qty, 0) < ol.quantity`,
      [id],
    );
    if (rows.length) {
      throw AppError.conflict(`Not fully picked: ${rows.map((r) => `${r.sku} (${Number(r.picked)}/${Number(r.quantity)})`).join(', ')}`);
    }
    await db.query('UPDATE operations SET packed_at = now(), packed_by = $1, updated_at = now() WHERE id = $2', [actor.id, id]);
    await publishOperation(db, id, 'packed', actor);
    return getOperation(id, db);
  });
}

/** "Check availability" on a waiting (or ready) delivery: re-evaluates stock right now. */
export async function checkAvailability(id, actor) {
  return withTransaction(async (db) => {
    const op = await lockOperation(db, id);
    if (op.type !== 'delivery' || !['waiting', 'ready'].includes(op.status)) {
      throw AppError.badRequest('Only confirmed deliveries can be checked');
    }
    const status = await setDeliveryAvailability(db, op);
    if (status !== op.status) await publishOperation(db, id, status === 'ready' ? 'stock-available' : 'stock-short', actor);
    return getOperation(id, db);
  });
}

export async function cancelOperation(id, actor) {
  return withTransaction(async (db) => {
    const op = await lockOperation(db, id);
    if (['done', 'canceled'].includes(op.status)) throw AppError.conflict(`Operation is already ${op.status}`);
    await db.query(`UPDATE operations SET status='canceled', updated_at=now() WHERE id=$1`, [id]);
    await publishOperation(db, id, 'canceled', actor);
    return getOperation(id, db);
  });
}

/**
 * Inventory adjustment: user enters the physically counted qty per product,
 * the system posts the difference against the virtual "Inventory adjustment" location.
 */
export async function createAdjustment({ locationId, notes, lines }, actor) {
  return withTransaction(async (db) => {
    const { rows: loc } = await db.query(
      `SELECT l.warehouse_id FROM locations l JOIN warehouses w ON w.id = l.warehouse_id
        WHERE l.id = $1 AND l.type = 'internal' AND l.is_active AND w.is_active`,
      [locationId],
    );
    if (!loc[0]) throw AppError.badRequest('Invalid location', { locationId: 'Choose an active location' });
    await assertActiveProducts(db, lines.map((l) => l.productId));
    const adjLoc = await virtualLocationId('inventory_loss', db);
    const reference = await nextReference(db, loc[0].warehouse_id, 'adjustment');

    const { rows } = await db.query(
      `INSERT INTO operations (reference, type, status, warehouse_id, source_location_id, dest_location_id,
                               contact, notes, responsible_id, created_by, validated_at)
       VALUES ($1,'adjustment','done',$2,$3,$4,'Inventory adjustment',$5,$6,$6,now()) RETURNING id`,
      [reference, loc[0].warehouse_id, adjLoc, locationId, notes || null, actor.id],
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
        userId: actor.id,
      });
    }
    await publishOperation(db, opId, 'validated', actor);
    await afterStockChange(db, lines.map((l) => l.productId), actor);
    return getOperation(opId, db);
  });
}

/**
 * Keep open deliveries honest after stock moves (mock-up: "Waiting = waiting for the
 * out-of-stock product to be in"): waiting -> ready when stock arrives, ready -> waiting
 * when another document consumed it. Runs inside the caller's transaction.
 */
export async function refreshDeliveriesForProducts(db, productIds, actor) {
  if (!productIds.length) return;
  const { rows } = await db.query(
    `SELECT o.id, o.status FROM operations o
      WHERE o.type = 'delivery' AND o.status IN ('waiting','ready')
        AND EXISTS (SELECT 1 FROM operation_lines ol WHERE ol.operation_id = o.id AND ol.product_id = ANY($1))
      ORDER BY o.id FOR UPDATE`,
    [productIds],
  );
  for (const op of rows) {
    const full = await lockOperation(db, op.id);
    const next = (await allLinesAvailable(db, full)) ? 'ready' : 'waiting';
    if (next === op.status) continue;
    await setDeliveryAvailability(db, full);
    await publishOperation(db, op.id, next === 'ready' ? 'stock-available' : 'stock-short', actor);
  }
}

/** Everything that must happen whenever stock levels change. */
export async function afterStockChange(db, productIds, actor) {
  const ids = [...new Set(productIds.map(Number))];
  await publish(db, 'stock', { productIds: ids }, actor);
  await refreshDeliveriesForProducts(db, ids, actor);
}


export async function batchConfirmOperations(ids, actor) {
  const results = { succeeded: [], failed: [] };
  for (const id of ids) {
    try {
      const type = await getOperationType(id);
      if (!can(actor.role, `${type}.process`)) {
        throw AppError.forbidden(`You cannot process ${type} operations`);
      }
      const op = await confirmOperation(id, actor);
      results.succeeded.push({ id, reference: op.reference });
    } catch (err) {
      results.failed.push({ id, error: err.message });
    }
  }
  return results;
}

export async function batchCancelOperations(ids, actor) {
  const results = { succeeded: [], failed: [] };
  for (const id of ids) {
    try {
      const type = await getOperationType(id);
      if (!can(actor.role, `${type}.manage`)) {
        throw AppError.forbidden(`You cannot cancel ${type} operations`);
      }
      const op = await cancelOperation(id, actor);
      results.succeeded.push({ id, reference: op.reference });
    } catch (err) {
      results.failed.push({ id, error: err.message });
    }
  }
  return results;
}
