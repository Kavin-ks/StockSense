-- StockSense core schema
-- Design notes:
--  * Every stock change is an immutable row in stock_moves (the ledger).
--  * stock_quants is a materialised "current stock per product per location",
--    updated in the same transaction as the ledger insert, so reads stay O(1).
--  * Vendor / customer / inventory-loss are modelled as *virtual* locations,
--    so a receipt, delivery, transfer and adjustment are all just
--    "move qty from location A to location B".

CREATE TYPE location_type  AS ENUM ('internal', 'vendor', 'customer', 'inventory_loss');
CREATE TYPE operation_type AS ENUM ('receipt', 'delivery', 'internal', 'adjustment');
CREATE TYPE operation_status AS ENUM ('draft', 'waiting', 'ready', 'done', 'canceled');

-- ---------------------------------------------------------------- users / auth
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  login_id      VARCHAR(12)  NOT NULL UNIQUE CHECK (char_length(login_id) BETWEEN 6 AND 12),
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'manager' CHECK (role IN ('manager', 'staff')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));

CREATE TABLE password_reset_otps (
  id          SERIAL PRIMARY KEY,
  user_id     INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp_hash    VARCHAR(255) NOT NULL,
  attempts    SMALLINT     NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ  NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_otps_user_idx ON password_reset_otps (user_id, created_at DESC);

-- ---------------------------------------------------------------- warehouses & locations
CREATE TABLE warehouses (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  short_code  VARCHAR(10)  NOT NULL UNIQUE,
  address     TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE locations (
  id           SERIAL PRIMARY KEY,
  warehouse_id INT REFERENCES warehouses(id) ON DELETE RESTRICT,
  name         VARCHAR(120)  NOT NULL,
  short_code   VARCHAR(20)   NOT NULL,
  type         location_type NOT NULL DEFAULT 'internal',
  is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- internal locations must belong to a warehouse; virtual ones must not
  CHECK ((type = 'internal') = (warehouse_id IS NOT NULL))
);
CREATE UNIQUE INDEX locations_wh_code_uq ON locations (warehouse_id, short_code) WHERE warehouse_id IS NOT NULL;
CREATE UNIQUE INDEX locations_virtual_type_uq ON locations (type) WHERE warehouse_id IS NULL;

-- ---------------------------------------------------------------- products
CREATE TABLE product_categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX product_categories_name_uq ON product_categories (lower(name));

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(160)  NOT NULL,
  sku         VARCHAR(40)   NOT NULL,
  category_id INT REFERENCES product_categories(id) ON DELETE SET NULL,
  uom         VARCHAR(20)   NOT NULL DEFAULT 'Units',
  unit_cost   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX products_sku_uq ON products (upper(sku));
CREATE INDEX products_name_idx ON products (lower(name));
CREATE INDEX products_category_idx ON products (category_id);

-- Reordering rule: alert when free qty in a warehouse drops to/below min_qty
CREATE TABLE reorder_rules (
  id           SERIAL PRIMARY KEY,
  product_id   INT NOT NULL REFERENCES products(id)   ON DELETE CASCADE,
  warehouse_id INT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  min_qty      NUMERIC(14,3) NOT NULL CHECK (min_qty >= 0),
  max_qty      NUMERIC(14,3) NOT NULL,
  CHECK (max_qty >= min_qty),
  UNIQUE (product_id, warehouse_id)
);

-- ---------------------------------------------------------------- stock
CREATE TABLE stock_quants (
  product_id   INT NOT NULL REFERENCES products(id)  ON DELETE RESTRICT,
  location_id  INT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  quantity     NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_qty NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, location_id)
);
CREATE INDEX stock_quants_location_idx ON stock_quants (location_id);

-- Per-warehouse, per-type counters for references like WH/IN/0001
CREATE TABLE operation_sequences (
  warehouse_id INT            NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  type         operation_type NOT NULL,
  next_value   INT            NOT NULL DEFAULT 1,
  PRIMARY KEY (warehouse_id, type)
);

CREATE TABLE operations (
  id                   SERIAL PRIMARY KEY,
  reference            VARCHAR(40)      NOT NULL UNIQUE,
  type                 operation_type   NOT NULL,
  status               operation_status NOT NULL DEFAULT 'draft',
  warehouse_id         INT NOT NULL REFERENCES warehouses(id),
  source_location_id   INT NOT NULL REFERENCES locations(id),
  dest_location_id     INT NOT NULL REFERENCES locations(id),
  contact              VARCHAR(160),
  delivery_address     TEXT,
  scheduled_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  responsible_id       INT REFERENCES users(id) ON DELETE SET NULL,
  notes                TEXT,
  validated_at         TIMESTAMPTZ,
  created_by           INT REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (source_location_id <> dest_location_id)
);
CREATE INDEX operations_type_status_idx ON operations (type, status);
CREATE INDEX operations_warehouse_idx   ON operations (warehouse_id);
CREATE INDEX operations_scheduled_idx   ON operations (scheduled_date);

CREATE TABLE operation_lines (
  id           SERIAL PRIMARY KEY,
  operation_id INT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  product_id   INT NOT NULL REFERENCES products(id),
  quantity     NUMERIC(14,3) NOT NULL CHECK (quantity >= 0),
  -- only used by adjustments: the physically counted quantity
  counted_qty  NUMERIC(14,3) CHECK (counted_qty >= 0),
  UNIQUE (operation_id, product_id)
);

-- The ledger. Append-only: never UPDATE or DELETE rows here.
CREATE TABLE stock_moves (
  id               BIGSERIAL PRIMARY KEY,
  operation_id     INT REFERENCES operations(id) ON DELETE SET NULL,
  reference        VARCHAR(40)   NOT NULL,
  product_id       INT NOT NULL REFERENCES products(id),
  from_location_id INT NOT NULL REFERENCES locations(id),
  to_location_id   INT NOT NULL REFERENCES locations(id),
  quantity         NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  contact          VARCHAR(160),
  created_by       INT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX stock_moves_product_idx ON stock_moves (product_id, created_at DESC);
CREATE INDEX stock_moves_created_idx ON stock_moves (created_at DESC);
CREATE INDEX stock_moves_reference_idx ON stock_moves (reference);

-- Virtual locations shared by all warehouses
INSERT INTO locations (warehouse_id, name, short_code, type) VALUES
  (NULL, 'Vendors',                'VENDOR',   'vendor'),
  (NULL, 'Customers',              'CUSTOMER', 'customer'),
  (NULL, 'Inventory adjustment',   'ADJ',      'inventory_loss');
