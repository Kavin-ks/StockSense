-- Profile page backed by real data.
--  * phone / department: editable profile fields (were placeholders in the UI).
--  * user_sessions: one row per sign-in. The JWT carries the session id, so a session can be
--    listed ("Active sessions") and revoked (sign out other devices, password change, deletion).
--  * user_preferences: per-user settings (landing page, formats, default warehouse, alert toggles)
--    stored as validated JSONB instead of browser localStorage.
--  * 'deleted' user status: removing an employee anonymises the account but keeps the row,
--    so documents and ledger entries they created still show who did the work.

ALTER TABLE users ADD COLUMN phone      VARCHAR(30);
ALTER TABLE users ADD COLUMN department VARCHAR(80);
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

-- New enum values cannot be used in the same transaction; nothing below uses it.
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'deleted';

CREATE TABLE user_sessions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent   VARCHAR(400),
  ip_address   VARCHAR(64),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ
);
CREATE INDEX user_sessions_active_idx ON user_sessions (user_id, last_seen_at DESC) WHERE revoked_at IS NULL;

CREATE TABLE user_preferences (
  user_id    INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  prefs      JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(prefs) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
