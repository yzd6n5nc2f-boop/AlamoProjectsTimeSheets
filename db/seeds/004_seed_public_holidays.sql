BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('timesheet-seed-lock', 0));

INSERT INTO calendar_public_holiday (
  rule_set_id,
  holiday_date,
  holiday_name,
  region_code,
  is_paid
)
SELECT rs.id, h.holiday_date, h.holiday_name, 'AU-NSW', TRUE
FROM calendar_rule_set rs
CROSS JOIN (
  VALUES
    (DATE '2026-01-01', 'New Year''s Day'),
    (DATE '2026-01-26', 'Australia Day'),
    (DATE '2026-04-03', 'Good Friday'),
    (DATE '2026-04-06', 'Easter Monday'),
    (DATE '2026-12-25', 'Christmas Day'),
    (DATE '2026-12-28', 'Boxing Day (Observed)')
) AS h(holiday_date, holiday_name)
WHERE rs.rule_name = 'AU-NSW-BASELINE' AND rs.version_no = 1
ON CONFLICT (rule_set_id, holiday_date, region_code) DO UPDATE
SET
  holiday_name = EXCLUDED.holiday_name,
  is_paid = EXCLUDED.is_paid;

INSERT INTO seed_history (seed_key, checksum_sha256)
VALUES ('S004', repeat('d', 64))
ON CONFLICT (seed_key) DO UPDATE
SET
  checksum_sha256 = EXCLUDED.checksum_sha256,
  applied_at = now();

COMMIT;
