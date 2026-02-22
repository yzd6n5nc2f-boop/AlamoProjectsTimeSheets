BEGIN;

CREATE TABLE seed_history (
  seed_key TEXT PRIMARY KEY,
  checksum_sha256 CHAR(64) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
