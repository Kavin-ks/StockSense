// CSV product import: validation is all-or-nothing, rows upsert by SKU.
import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { importProducts } from '../src/modules/import/import.service.js';
import { query } from '../src/db/pool.js';
import { closePool, createUser, resetDb } from './helpers.js';

beforeEach(resetDb);
after(closePool);

test('imports new products, creates categories, and updates existing SKUs', async () => {
  const actor = await createUser('manager');
  const csv = 'sku,name,category,uom,unit_cost\nDESK1,"Desk, oak",Furniture,Units,3000\nROD1,Steel rod,Raw,kg,65\n';
  assert.deepEqual(await importProducts(csv, { dryRun: false }, actor), { total: 2, created: 2, updated: 0, dryRun: false });
  const again = await importProducts('SKU,Name,Unit_Cost\ndesk1,Desk (updated),3100\n', { dryRun: false }, actor);
  assert.equal(again.updated, 1);
  const { rows } = await query(`SELECT name, unit_cost FROM products WHERE sku = 'DESK1'`);
  assert.deepEqual(rows[0], { name: 'Desk (updated)', unit_cost: 3100 });
});

test('any invalid row rejects the whole file with row numbers', async () => {
  const actor = await createUser('manager');
  await assert.rejects(
    importProducts('sku,name,unit_cost\nOK1,Fine,1\nBAD 2,Space in sku,1\nOK1,Duplicate,1\n', { dryRun: false }, actor),
    (err) => err.details.rows.map((r) => r.row).join() === '3,4',
  );
  const { rows } = await query('SELECT count(*)::int AS n FROM products');
  assert.equal(rows[0].n, 0);
});
