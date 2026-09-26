// Document status machine, references, delivery availability and picking rules.
import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as ops from '../src/modules/operations/operations.service.js';
import * as products from '../src/modules/products/products.service.js';
import { closePool, createProduct, readyDocument, resetDb, setupWarehouse } from './helpers.js';

beforeEach(resetDb);
after(closePool);
const today = new Date().toISOString().slice(0, 10);

test('references are consecutive per warehouse and type', async () => {
  const { actor, warehouse } = await setupWarehouse('WH');
  const p = await createProduct(actor, { sku: 'A' });
  const doc = { type: 'receipt', warehouseId: warehouse.id, contact: 'V', scheduledDate: today, lines: [{ productId: p.id, quantity: 1 }] };
  const [r1, r2] = [await ops.createOperation(doc, actor), await ops.createOperation(doc, actor)];
  assert.equal(r1.reference, 'WH/IN/0001');
  assert.equal(r2.reference, 'WH/IN/0002');
});

test('cannot validate a draft, validate twice, or edit a done document', async () => {
  const { actor, warehouse } = await setupWarehouse();
  const p = await createProduct(actor, { sku: 'A' });
  const doc = { type: 'receipt', warehouseId: warehouse.id, contact: 'V', scheduledDate: today, lines: [{ productId: p.id, quantity: 1 }] };
  const draft = await ops.createOperation(doc, actor);
  await assert.rejects(ops.validateOperation(draft.id, actor), /To Do first/);

  await ops.confirmOperation(draft.id, actor);
  await ops.validateOperation(draft.id, actor);
  await assert.rejects(ops.validateOperation(draft.id, actor), /already done/);
  await assert.rejects(ops.updateOperation(draft.id, doc, actor), /done operation cannot be edited/);
});

test('delivery waits when stock is short and becomes ready automatically when stock arrives', async () => {
  const { actor, warehouse } = await setupWarehouse();
  const p = await createProduct(actor, { sku: 'CHAIR' });
  const delivery = await readyDocument(actor, { type: 'delivery', warehouseId: warehouse.id, contact: 'C', lines: [{ productId: p.id, quantity: 5 }] });
  assert.equal(delivery.status, 'waiting');
  await assert.rejects(ops.validateOperation(delivery.id, actor), /not in stock/);

  const receipt = await readyDocument(actor, { type: 'receipt', warehouseId: warehouse.id, contact: 'V', lines: [{ productId: p.id, quantity: 5 }] });
  await ops.validateOperation(receipt.id, actor);
  assert.equal((await ops.getOperation(delivery.id)).status, 'ready');
});

test('delivery must be fully picked before packing, and packed before validating', async () => {
  const { actor, warehouse, stock } = await setupWarehouse();
  const p = await createProduct(actor, { sku: 'BOX', stock: 10, locationId: stock.id });
  const op = await ops.createOperation({ type: 'delivery', warehouseId: warehouse.id, contact: 'C', scheduledDate: today, lines: [{ productId: p.id, quantity: 4 }] }, actor);
  const ready = await ops.confirmOperation(op.id, actor);

  await assert.rejects(ops.validateOperation(op.id, actor), /Pick and pack/);
  await ops.pickDelivery(op.id, { lines: [{ lineId: ready.lines[0].id, pickedQty: 3 }] }, actor);
  await assert.rejects(ops.packDelivery(op.id, actor), /Not fully picked: BOX \(3\/4\)/);
  await assert.rejects(ops.pickDelivery(op.id, { lines: [{ lineId: ready.lines[0].id, pickedQty: 5 }] }, actor), /more than ordered/);

  await ops.pickDelivery(op.id, { lines: [{ lineId: ready.lines[0].id, pickedQty: 4 }] }, actor);
  await ops.packDelivery(op.id, actor);
  const done = await ops.validateOperation(op.id, actor);
  assert.equal(done.status, 'done');
});

test('archived products cannot be used on new documents, and products with stock cannot be archived', async () => {
  const { actor, warehouse, stock } = await setupWarehouse();
  const inStock = await createProduct(actor, { sku: 'KEEP', stock: 3, locationId: stock.id });
  await assert.rejects(products.setProductActive(inStock.id, false, actor), /still holds 3/);

  const empty = await createProduct(actor, { sku: 'OLD' });
  await products.setProductActive(empty.id, false, actor);
  await assert.rejects(
    ops.createOperation({ type: 'receipt', warehouseId: warehouse.id, contact: 'V', scheduledDate: today, lines: [{ productId: empty.id, quantity: 1 }] }, actor),
    /Archived product/,
  );
});
