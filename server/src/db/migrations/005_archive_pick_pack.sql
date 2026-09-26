-- Archive instead of delete: rows referenced by the ledger are never removed.
-- products.is_active and locations.is_active already exist; warehouses and categories get one too.
ALTER TABLE warehouses         ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE product_categories ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Delivery pick -> pack -> validate (problem statement: "Pick items, Pack items, Validate").
-- picked_qty is what staff actually picked per line; packed_at/packed_by mark the whole order packed.
ALTER TABLE operation_lines ADD COLUMN picked_qty NUMERIC(14,3) CHECK (picked_qty >= 0);
ALTER TABLE operations ADD COLUMN packed_at TIMESTAMPTZ;
ALTER TABLE operations ADD COLUMN packed_by INT REFERENCES users(id) ON DELETE SET NULL;
