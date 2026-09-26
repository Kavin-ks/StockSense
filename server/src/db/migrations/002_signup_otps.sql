-- Signup verification OTP table for email ownership verification
CREATE TABLE IF NOT EXISTS signup_otps (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  otp_hash    VARCHAR(255) NOT NULL,
  attempts    SMALLINT     NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ  NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signup_otps_email_idx ON signup_otps (lower(email), created_at DESC);
