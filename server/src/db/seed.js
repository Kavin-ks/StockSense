// Demo data, created through the same services the API uses, so the ledger is consistent.
// Usage: npm run db:seed   (skips if users already exist)
import { pool, query } from './pool.js';
import * as auth from '../modules/auth/auth.service.js';
import * as wh from '../modules/warehouses/warehouses.service.js';
import * as products from '../modules/products/products.service.js';
import * as ops from '../modules/operations/operations.service.js';

const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

async function seed() {
  const { rows } = await query('SELECT count(*)::int AS n FROM users');
  if (rows[0].n > 0) return console.log('database already seeded — skipping');

  const { user } = await auth.signup({ loginId: 'demouser', name: 'Demo Manager', email: 'demo@stocksense.local', password: 'Demo@12345' });

  const main = await wh.createWarehouse({ name: 'Main Warehouse', shortCode: 'WH', address: '12 Industrial Estate, Chennai' });
  const second = await wh.createWarehouse({ name: 'Secondary Warehouse', shortCode: 'WH2', address: '4 Port Road, Chennai' });
  const [mainStock] = await wh.listLocations({ warehouseId: main.id });
  const rackA = await wh.createLocation({ warehouseId: main.id, name: 'Rack A', shortCode: 'RACK-A' });
  await wh.createLocation({ warehouseId: main.id, name: 'Production Floor', shortCode: 'PROD' });
  const [secondStock] = await wh.listLocations({ warehouseId: second.id });

  const furniture = await products.createCategory({ name: 'Furniture' });
  const raw = await products.createCategory({ name: 'Raw Material' });

  const desk = await products.createProduct({ name: 'Desk', sku: 'DESK001', categoryId: furniture.id, uom: 'Units', unitCost: 3000, initialStock: 50, initialLocationId: mainStock.id }, user.id);
  const table = await products.createProduct({ name: 'Table', sku: 'TABLE001', categoryId: furniture.id, uom: 'Units', unitCost: 3000, initialStock: 50, initialLocationId: mainStock.id }, user.id);
  const chair = await products.createProduct({ name: 'Chair', sku: 'CHAIR001', categoryId: furniture.id, uom: 'Units', unitCost: 900, initialStock: 8, initialLocationId: mainStock.id }, user.id);
  const steel = await products.createProduct({ name: 'Steel Rods', sku: 'STEEL001', categoryId: raw.id, uom: 'kg', unitCost: 65 }, user.id);
  await products.createProduct({ name: 'Plywood Sheet', sku: 'PLY001', categoryId: raw.id, uom: 'Units', unitCost: 1200, initialStock: 20, initialLocationId: secondStock.id }, user.id);

  await products.upsertReorderRule(chair.id, { warehouseId: main.id, minQty: 10, maxQty: 50 });
  await products.upsertReorderRule(steel.id, { warehouseId: main.id, minQty: 20, maxQty: 200 });

  // The example flow from the problem statement: receive 100 kg steel, move to rack, deliver 20, 3 damaged.
  const r1 = await ops.createOperation({ type: 'receipt', warehouseId: main.id, contact: 'Azure Interior', scheduledDate: day(0), lines: [{ productId: steel.id, quantity: 100 }] }, user.id);
  await ops.confirmOperation(r1.id);
  await ops.validateOperation(r1.id, user.id);

  const t1 = await ops.createOperation({ type: 'internal', warehouseId: main.id, sourceLocationId: mainStock.id, destLocationId: rackA.id, scheduledDate: day(0), lines: [{ productId: steel.id, quantity: 100 }] }, user.id);
  await ops.confirmOperation(t1.id);
  await ops.validateOperation(t1.id, user.id);

  const d1 = await ops.createOperation({ type: 'delivery', warehouseId: main.id, sourceLocationId: rackA.id, contact: 'Azure Interior', deliveryAddress: 'Azure Interior, Anna Nagar', scheduledDate: day(0), lines: [{ productId: steel.id, quantity: 20 }] }, user.id);
  await ops.confirmOperation(d1.id);
  await ops.validateOperation(d1.id, user.id);

  await ops.createAdjustment({ locationId: rackA.id, notes: '3 kg damaged', lines: [{ productId: steel.id, countedQty: 77 }] }, user.id);

  // Open documents so the dashboard has something to show.
  await ops.createOperation({ type: 'receipt', warehouseId: main.id, contact: 'Azure Interior', scheduledDate: day(-2), lines: [{ productId: desk.id, quantity: 6 }] }, user.id);
  const r3 = await ops.createOperation({ type: 'receipt', warehouseId: main.id, contact: 'Wood Corp', scheduledDate: day(3), lines: [{ productId: table.id, quantity: 10 }] }, user.id);
  await ops.confirmOperation(r3.id);
  const d2 = await ops.createOperation({ type: 'delivery', warehouseId: main.id, contact: 'Azure Interior', scheduledDate: day(1), lines: [{ productId: desk.id, quantity: 6 }] }, user.id);
  await ops.confirmOperation(d2.id);
  const d3 = await ops.createOperation({ type: 'delivery', warehouseId: main.id, contact: 'Bright Offices', scheduledDate: day(-1), lines: [{ productId: chair.id, quantity: 25 }] }, user.id);
  await ops.confirmOperation(d3.id); // not enough chairs -> waiting
  await ops.createOperation({ type: 'internal', warehouseId: main.id, sourceLocationId: mainStock.id, destLocationId: secondStock.id, scheduledDate: day(2), lines: [{ productId: table.id, quantity: 5 }] }, user.id);

  console.log('seeded. Sign in with  demouser / Demo@12345');
}

seed()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => pool.end());
