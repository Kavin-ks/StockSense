-- Sign-up approval.
-- A user's lifecycle is now an explicit state instead of a boolean:
--   pending     -> signed up from the login page, cannot sign in until a manager approves
--   active      -> can sign in (approved, or created directly by a manager)
--   deactivated -> access removed by a manager (history is kept)
-- A rejected sign-up is deleted: a pending account has never acted, so nothing references it.
CREATE TYPE user_status AS ENUM ('pending', 'active', 'deactivated');

-- Default 'pending' so any account created without an explicit status is safe by default.
ALTER TABLE users ADD COLUMN status user_status NOT NULL DEFAULT 'pending';
UPDATE users SET status = CASE WHEN is_active THEN 'active' ELSE 'deactivated' END::user_status;

ALTER TABLE users ADD COLUMN approved_by INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN approved_at TIMESTAMPTZ;
UPDATE users SET approved_at = created_at WHERE status <> 'pending';
-- An account that has ever been active must carry an approval time.
ALTER TABLE users ADD CONSTRAINT users_approved_chk CHECK (status = 'pending' OR approved_at IS NOT NULL);

DROP INDEX users_active_managers_idx;
ALTER TABLE users DROP COLUMN is_active;
CREATE INDEX users_active_managers_idx ON users (id) WHERE role = 'manager' AND status = 'active';
CREATE INDEX users_pending_idx ON users (created_at) WHERE status = 'pending';
