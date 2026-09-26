/**
 * Bulk product import from CSV (the migration path away from Excel sheets).
 *  - Columns (header row, any order, case-insensitive): sku, name, category, uom, unit_cost.
 *    Other columns are ignored, so a file from Export -> Products can be edited and re-imported.
 *  - Upsert by SKU: new SKUs are created, existing ones updated. Missing categories are created.
 *  - All-or-nothing: every row is validated first; any error rejects the whole file with row numbers.
 *  - Stock quantities are NOT imported: stock only changes through the ledger (use an adjustment).
 */
import { withTransaction } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { parseCsv } from '../../utils/csv.js';
import { productSchema } from '../products/products.schemas.js';
import { publish } from '../realtime/realtime.bus.js';

const MAX_ROWS = 5000;
const REQUIRED = ['sku', 'name'];

export async function importProducts(csvText, { dryRun }, actor) {
  const rows = parseCsv(csvText ?? '');
  if (rows.length < 2) throw AppError.badRequest('The file needs a header row and at least one product');
  if (rows.length - 1 > MAX_ROWS) throw AppError.badRequest(`At most ${MAX_ROWS} products per file`);

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) throw AppError.badRequest(`Missing column(s): ${missing.join(', ')}`);
  const col = (r, name) => (header.includes(name) ? (r[header.indexOf(name)] ?? '').trim() : '');

  const errors = [];
  const items = [];
  const seen = new Map();
  rows.slice(1).forEach((r, i) => {
    const line = i + 2; // spreadsheet row number (header is row 1)
    const category = col(r, 'category');
    const parsed = productSchema.safeParse({
      name: col(r, 'name'),
      sku: col(r, 'sku'),
      uom: col(r, 'uom') || 'Units',
      unitCost: col(r, 'unit_cost') || '0',
    });
    if (!parsed.success) {
      errors.push({ row: line, message: parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') });
      return;
    }
    if (seen.has(parsed.data.sku)) {
      errors.push({ row: line, message: `sku: ${parsed.data.sku} also appears on row ${seen.get(parsed.data.sku)}` });
      return;
    }
    seen.set(parsed.data.sku, line);
    items.push({ ...parsed.data, category: category && category.toLowerCase() !== 'uncategorized' ? category : null });
  });
  if (errors.length) {
    throw AppError.badRequest(`${errors.length} row(s) have problems; nothing was imported`, { rows: errors.slice(0, 50) });
  }

  return withTransaction(async (db) => {
    const { rows: existing } = await db.query('SELECT upper(sku) AS sku FROM products WHERE upper(sku) = ANY($1)', [items.map((x) => x.sku)]);
    const existingSkus = new Set(existing.map((r) => r.sku));
    const summary = { total: items.length, created: items.filter((x) => !existingSkus.has(x.sku)).length, updated: existingSkus.size };
    if (dryRun) return { ...summary, dryRun: true };

    const categoryIds = new Map();
    for (const name of [...new Set(items.map((x) => x.category).filter(Boolean))]) {
      const { rows: c } = await db.query(
        `INSERT INTO product_categories (name) VALUES ($1)
         ON CONFLICT (lower(name)) DO UPDATE SET is_active = TRUE RETURNING id`,
        [name],
      );
      categoryIds.set(name, c[0].id);
    }
    for (const x of items) {
      await db.query(
        `INSERT INTO products (name, sku, category_id, uom, unit_cost) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (upper(sku)) DO UPDATE
           SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, uom = EXCLUDED.uom,
               unit_cost = EXCLUDED.unit_cost, updated_at = now()`,
        [x.name, x.sku, x.category ? categoryIds.get(x.category) : null, x.uom, x.unitCost],
      );
    }
    await publish(db, 'products', { action: 'imported', count: items.length }, actor);
    await publish(db, 'categories', { action: 'imported' }, actor);
    return { ...summary, dryRun: false };
  });
}
