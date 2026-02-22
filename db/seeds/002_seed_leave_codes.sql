BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('timesheet-seed-lock', 0));

INSERT INTO leave_code (code, description, is_paid, accrues, active, export_earning_code)
VALUES
  ('AL', 'Annual Leave', TRUE, TRUE, TRUE, 'LEAVE_AL'),
  ('SL', 'Sick Leave', TRUE, TRUE, TRUE, 'LEAVE_SL'),
  ('LWOP', 'Leave Without Pay', FALSE, FALSE, TRUE, 'LEAVE_LWOP'),
  ('PH', 'Public Holiday Not Worked', TRUE, FALSE, TRUE, 'LEAVE_PH')
ON CONFLICT (code) DO UPDATE
SET
  description = EXCLUDED.description,
  is_paid = EXCLUDED.is_paid,
  accrues = EXCLUDED.accrues,
  active = EXCLUDED.active,
  export_earning_code = EXCLUDED.export_earning_code;

INSERT INTO seed_history (seed_key, checksum_sha256)
VALUES ('S002', repeat('b', 64))
ON CONFLICT (seed_key) DO UPDATE
SET
  checksum_sha256 = EXCLUDED.checksum_sha256,
  applied_at = now();

COMMIT;
