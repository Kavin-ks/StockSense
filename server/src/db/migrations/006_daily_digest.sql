-- One row per user per day a digest was sent. The primary key makes sending idempotent:
-- if several API instances run the scheduler, only the one that inserts the row sends the email.
CREATE TABLE daily_digest_log (
  user_id     INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  digest_date DATE NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, digest_date)
);
