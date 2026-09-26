import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { pool } from '../../db/pool.js';

const router = Router();

function toCsv(rows, columns) {
  if (!rows.length) return columns.join(',') + '\n';
  const header = columns.join(',');
  const body = rows.map(r => columns.map(c => {
    let v = r[c] ?? '';
    v = String(v).replace(/"/g, '""');
    return v.includes(',') || v.includes('"') || v.includes('\n') ? ('"' + v + '"') : v;
  }).join(',')).join('\n');
  return header + '\n' + body + '\n';
}

// GET /api/export/products
router.get('/products', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT p.id, p.sku, p.name, COALESCE(c.name, 'Uncategorized') AS category,
           p.uom, p.unit_cost, p.is_active,
           COALESCE(SUM(sq.quantity), 0) AS total_on_hand,
           COALESCE(SUM(sq.reserved_qty), 0) AS total_reserved,
           (COALESCE(SUM(sq.quantity), 0) - COALESCE(SUM(sq.reserved_qty), 0)) AS free_to_use
    FROM products p
    LEFT JOIN product_categories c ON c.id = p.category_id
    LEFT JOIN stock_quants sq ON sq.product_id = p.id
    GROUP BY p.id, c.name
    ORDER BY p.name
  `);
  const csv = toCsv(rows, ['id', 'sku', 'name', 'category', 'uom', 'unit_cost', 'is_active', 'total_on_hand', 'total_reserved', 'free_to_use']);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=stocksense-products.csv');
  res.send(csv);
}));

// GET /api/export/stock
router.get('/stock', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT p.sku, p.name AS product, l.short_code AS location,
           COALESCE(w.name, 'Virtual') AS warehouse, sq.quantity AS on_hand,
           sq.reserved_qty AS reserved,
           (sq.quantity - sq.reserved_qty) AS free_to_use
    FROM stock_quants sq
    JOIN products p ON p.id = sq.product_id
    JOIN locations l ON l.id = sq.location_id
    LEFT JOIN warehouses w ON w.id = l.warehouse_id
    ORDER BY p.name, w.name
  `);
  const csv = toCsv(rows, ['sku', 'product', 'location', 'warehouse', 'on_hand', 'reserved', 'free_to_use']);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=stocksense-stock.csv');
  res.send(csv);
}));

// GET /api/export/moves
router.get('/moves', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT m.id, m.reference, p.sku, p.name AS product,
           fl.short_code AS from_location, tl.short_code AS to_location,
           m.quantity, COALESCE(m.contact, '') AS contact,
           COALESCE(u.name, '') AS created_by, m.created_at
    FROM stock_moves m
    JOIN products p ON p.id = m.product_id
    JOIN locations fl ON fl.id = m.from_location_id
    JOIN locations tl ON tl.id = m.to_location_id
    LEFT JOIN users u ON u.id = m.created_by
    ORDER BY m.created_at DESC
    LIMIT 5000
  `);
  const csv = toCsv(rows, ['id', 'reference', 'sku', 'product', 'from_location', 'to_location', 'quantity', 'contact', 'created_by', 'created_at']);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=stocksense-moves.csv');
  res.send(csv);
}));

// GET /api/export/operations
router.get('/operations', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT o.id, o.reference, o.type, o.status, COALESCE(o.contact, '') AS contact,
           o.scheduled_date, COALESCE(u.name, '') AS created_by, o.created_at
    FROM operations o
    LEFT JOIN users u ON u.id = o.created_by
    ORDER BY o.created_at DESC
    LIMIT 5000
  `);
  const csv = toCsv(rows, ['id', 'reference', 'type', 'status', 'contact', 'scheduled_date', 'created_by', 'created_at']);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=stocksense-operations.csv');
  res.send(csv);
}));

export default router;
