// Stock engine: every flow is a move between locations, applied atomically with the ledger.
import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as ops from '../src/modules/operations/operations.service.js';
import { closePool, countMoves, createProduct, onHandAt, readyDocument, resetDb, setupWarehouse } from './helpers.js';

beforeEach(resetDb);
after(closePool);

test('receipt increases stock and writes one ledger row per line', async () => {
  const { actor, warehouse, stock } = await setupWarehouse();
  const p = await createProduct(actor, { sku: 'STEEL' });
  const receipt = await readyDocument(actor, { type: 'receipt', warehouseId: warehouse.id, contact: 'Vendor', lines: [{ productId: p.id, quantity: 100 }] });

  const before = await countMoves();
  await ops.validateOperation(receipt.id, actor);
  assert.equal(await onHandAt(p.id, stock.id), 100);
  assert.equal(await countMoves(), before + 1);
});

test('delivery decreases stock after pick -> pack -> validate', async () => {
  const { actor, warehouse, stock } = await setupWarehouse();
  const p = await createProduct(actor, { sku: 'CHAIR', stock: 10, locationId: stock.id });
  const delivery = await readyDocument(actor, { type: 'delivery', warehouseId: warehouse.id, contact: 'Customer', lines: [{ productId: p.id, quantity: 4 }] });

  assert.ok(delivery.packedAt, 'delivery should be packed');
  await ops.validateOperation(delivery.id, actor);
  assert.equal(await onHandAt(p.id, stock.id), 6);
});

test('a failing line rolls back the whole validation (stock and ledger unchanged)', async () => {
  const { actor, warehouse, stock } = await setupWarehouse();
  const plenty = await createProduct(actor, { sku: 'PLENTY', stock: 50, locationId: stock.id });
  const scarce = await createProduct(actor, { sku: 'SCARCE', stock: 1, locationId: stock.id });
  const delivery = await readyDocument(actor, {
    type: 'delivery', warehouseId: warehouse.id, contact: 'Customer',
    lines: [{ productId: plenty.id, quantity: 5 }, { productId: scarce.id, quantity: 1 }],
  });
  // Someone else takes the scarce unit after this delivery was packed.
  const other = await readyDocument(actor, { type: 'delivery', warehouseId: warehouse.id, contact: 'Other', lines: [{ productId: scarce.id, quantity: 1 }] });
  await ops.validateOperation(other.id, actor);

  const moves = await countMoves();
  await assert.rejects(ops.validateOperation(delivery.id, actor));
  assert.equal(await onHandAt(plenty.id, stock.id), 50, 'first line must be rolled back');
  assert.equal(await countMoves(), moves, 'no ledger rows may be written');
});

test('stock never goes negative when two deliveries are validated at the same time', async () => {
  const { actor, warehouse, stock } = await setupWarehouse();
  const p = await createProduct(actor, { sku: 'DESK', stock: 10, locationId: stock.id });
  const a = await readyDocument(actor, { type: 'delivery', warehouseId: warehouse.id, contact: 'A', lines: [{ productId: p.id, quantity: 8 }] });
  const b = await readyDocument(actor, { type: 'delivery', warehouseId: warehouse.id, contact: 'B', lines: [{ productId: p.id, quantity: 8 }] });

  const results = await Promise.allSettled([ops.validateOperation(a.id, actor), ops.validateOperation(b.id, actor)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await onHandAt(p.id, stock.id), 2);
});

test('adjustment posts the signed difference between counted and recorded stock', async () => {
  const { actor, stock } = await setupWarehouse();
  const lost = await createProduct(actor, { sku: 'LOST', stock: 10, locationId: stock.id });
  const found = await createProduct(actor, { sku: 'FOUND', stock: 10, locationId: stock.id });

  const adj = await ops.createAdjustment({ locationId: stock.id, notes: 'count', lines: [
    { productId: lost.id, countedQty: 7 }, { productId: found.id, countedQty: 12 },
  ] }, actor);
  assert.equal(await onHandAt(lost.id, stock.id), 7);
  assert.equal(await onHandAt(found.id, stock.id), 12);
  const delta = Object.fromEntries(adj.lines.map((l) => [l.sku, Number(l.delta)]));
  assert.deepEqual(delta, { LOST: -3, FOUND: 2 });
});

test('internal transfer keeps the total but changes the location', async () => {
  const { actor, warehouse, stock } = await setupWarehouse();
  const { rows } = await (await import('../src/db/pool.js')).query(
    `INSERT INTO locations (warehouse_id, name, short_code) VALUES ($1, 'Rack A', 'RACK-A') RETURNING id`, [warehouse.id]);
  const rack = rows[0].id;
  const p = await createProduct(actor, { sku: 'ROD', stock: 20, locationId: stock.id });
  const t = await readyDocument(actor, { type: 'internal', warehouseId: warehouse.id, sourceLocationId: stock.id, destLocationId: rack, lines: [{ productId: p.id, quantity: 15 }] });
  await ops.validateOperation(t.id, actor);
  assert.equal(await onHandAt(p.id, stock.id), 5);
  assert.equal(await onHandAt(p.id, rack), 15);
});
