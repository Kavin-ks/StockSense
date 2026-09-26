/**
 * Performance demo data: adds ~200 products and ~10,000 ledger moves spread over 90 days,
 * then rebuilds stock_quants from the ledger (stock_moves is the source of truth) and times
 * the heaviest read queries. Run after `npm run db:seed`:  npm run db:seed:perf
 */
import { performance } from 'node:perf_hooks';
import { pool, query, withTransaction } from '../db/pool.js';
import { getSummary } from '../modules/dashboard/dashboard.service.js';
import { listProducts } from '../modules/products/products.service.js';
import { listMoves } from '../modules/stock/stock.service.js';
import { stockInsights } from '../modules/reports/reports.service.js';

const PRODUCTS = 200;
const MOVES = 10_000;

async function main() {
  const { rows: wh } = await query(`SELECT l.id FROM locations l JOIN warehouses w ON w.id = l.warehouse_id
                                     WHERE l.type = 'internal' AND l.is_active ORDER BY l.id LIMIT 1`);
  if (!wh[0]) throw new Error('Run npm run db:seed first (needs a warehouse location).');
  const loc = wh[0].id;
  const { rows: v } = await query(`SELECT type, id FROM locations WHERE warehouse_id IS NULL`);
  const virtual = Object.fromEntries(v.map((r) => [r.type, r.id]));

  await withTransaction(async (db) => {
    await db.query(
      `INSERT INTO products (name, sku, uom, unit_cost)
       SELECT 'Bulk item ' || g, 'BULK' || lpad(g::text, 5, '0'), 'Units', (random() * 900 + 50)::numeric(12,2)
         FROM generate_series(1, $1) g
       ON CONFLICT (upper(sku)) DO NOTHING`,
      [PRODUCTS],
    );
    // Receipts in (60%) and deliveries out (40%), sized so stock stays positive overall.
    await db.query(
      `INSERT INTO stock_moves (reference, product_id, from_location_id, to_location_id, quantity, contact, created_at)
       SELECT 'PERF/' || g,
              p.id,
              CASE WHEN g % 5 < 3 THEN $2::int ELSE $3::int END,
              CASE WHEN g % 5 < 3 THEN $3::int ELSE $4::int END,
              CASE WHEN g % 5 < 3 THEN 20 + (g % 30) ELSE 1 + (g % 10) END,
              'Perf data',
              now() - (random() * interval '90 days')
         FROM generate_series(1, $1) g
         JOIN LATERAL (SELECT id FROM products WHERE sku LIKE 'BULK%' ORDER BY id OFFSET (g % $5::int) LIMIT 1) p ON true`,
      [MOVES, virtual.vendor, loc, virtual.customer, PRODUCTS],
    );
    // Rebuild the snapshot from the ledger: current stock = sum(in) - sum(out) per location.
    await db.query('DELETE FROM stock_quants');
    await db.query(
      `INSERT INTO stock_quants (product_id, location_id, quantity)
       SELECT product_id, location_id, sum(delta) FROM (
         SELECT m.product_id, m.to_location_id AS location_id, m.quantity AS delta
           FROM stock_moves m JOIN locations l ON l.id = m.to_location_id WHERE l.type = 'internal'
         UNION ALL
         SELECT m.product_id, m.from_location_id, -m.quantity
           FROM stock_moves m JOIN locations l ON l.id = m.from_location_id WHERE l.type = 'internal'
       ) x GROUP BY product_id, location_id HAVING sum(delta) > 0`,
    );
  });

  const time = async (label, fn) => {
    const t = performance.now();
    await fn();
    console.log(`${label.padEnd(34)} ${(performance.now() - t).toFixed(1)} ms`);
  };
  const { rows: n } = await query('SELECT (SELECT count(*) FROM stock_moves) AS moves, (SELECT count(*) FROM products) AS products');
  console.log(`ledger: ${n[0].moves} moves, ${n[0].products} products\n`);
  await time('dashboard summary', () => getSummary({}));
  await time('product list (page 1, with stock)', () => listProducts({ page: 1, pageSize: 20 }));
  await time('move history (page 1)', () => listMoves({ page: 1, pageSize: 20 }));
  await time('insights (30-day window)', () => stockInsights({ windowDays: 30, deadDays: 60 }));
}

main()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => pool.end());
