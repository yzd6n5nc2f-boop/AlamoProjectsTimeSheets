BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('timesheet-seed-lock', 0));

INSERT INTO timesheet_period (
  period_name,
  period_start,
  period_end,
  submission_open_at,
  submission_close_at,
  lock_at,
  period_status,
  rule_set_id
)
SELECT
  '2026-P02',
  DATE '2026-02-02',
  DATE '2026-02-15',
  TIMESTAMPTZ '2026-01-31 00:00:00+11',
  TIMESTAMPTZ '2026-02-17 23:59:59+11',
  NULL,
  'OPEN',
  rs.id
FROM calendar_rule_set rs
WHERE rs.rule_name = 'AU-NSW-BASELINE' AND rs.version_no = 1
ON CONFLICT (period_start, period_end) DO UPDATE
SET
  period_name = EXCLUDED.period_name,
  submission_open_at = EXCLUDED.submission_open_at,
  submission_close_at = EXCLUDED.submission_close_at,
  lock_at = EXCLUDED.lock_at,
  period_status = EXCLUDED.period_status,
  rule_set_id = EXCLUDED.rule_set_id;

INSERT INTO seed_history (seed_key, checksum_sha256)
VALUES ('S005', repeat('e', 64))
ON CONFLICT (seed_key) DO UPDATE
SET
  checksum_sha256 = EXCLUDED.checksum_sha256,
  applied_at = now();

COMMIT;
