import { AppError } from './AppError.js';

/**
 * Shared guard for "archive instead of delete".
 * Refuses to archive something that still holds stock or is used by an open document,
 * because archived items disappear from pickers and would strand that stock or work.
 */
export async function assertArchivable(db, { label, stockSql, openDocsSql, params }) {
  const [{ rows: stock }, { rows: docs }] = await Promise.all([
    db.query(stockSql, params),
    db.query(openDocsSql, params),
  ]);
  const qty = Number(stock[0]?.qty ?? 0);
  if (qty > 0) {
    throw AppError.conflict(`${label} still holds ${qty} unit(s) of stock. Move it or adjust it to zero first.`);
  }
  if (docs.length) {
    const refs = docs.map((d) => d.reference).join(', ');
    throw AppError.conflict(`${label} is used by open document(s) ${refs}. Finish or cancel them first.`);
  }
}

const OPEN = `o.status IN ('draft','waiting','ready')`;

export const ARCHIVE_CHECKS = {
  product: {
    stockSql: `SELECT sum(q.quantity) AS qty FROM stock_quants q JOIN locations l ON l.id = q.location_id
               WHERE q.product_id = $1 AND l.type = 'internal'`,
    openDocsSql: `SELECT DISTINCT o.reference FROM operations o JOIN operation_lines ol ON ol.operation_id = o.id
                  WHERE ol.product_id = $1 AND ${OPEN} LIMIT 5`,
  },
  location: {
    stockSql: 'SELECT sum(quantity) AS qty FROM stock_quants WHERE location_id = $1',
    openDocsSql: `SELECT o.reference FROM operations o
                  WHERE (o.source_location_id = $1 OR o.dest_location_id = $1) AND ${OPEN} LIMIT 5`,
  },
  warehouse: {
    stockSql: `SELECT sum(q.quantity) AS qty FROM stock_quants q JOIN locations l ON l.id = q.location_id
               WHERE l.warehouse_id = $1`,
    openDocsSql: `SELECT o.reference FROM operations o
                  WHERE ${OPEN} AND (o.warehouse_id = $1 OR EXISTS (
                    SELECT 1 FROM locations l WHERE l.warehouse_id = $1 AND l.id IN (o.source_location_id, o.dest_location_id)))
                  LIMIT 5`,
  },
};
