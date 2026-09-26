-- Roles: Inventory Manager vs Warehouse Staff (see config/permissions.js for what each can do).
--  * Public sign-up now creates staff; managers are created by `npm run create-manager`
--    or promoted by another manager.
--  * Accounts are deactivated, never deleted, so the ledger keeps its "who did it".
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'staff';
ALTER TABLE users ADD COLUMN is_active  BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN created_by INT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX users_active_managers_idx ON users (id) WHERE role = 'manager' AND is_active;
