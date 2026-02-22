BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('timesheet-seed-lock', 0));

INSERT INTO employee_paid_hours_policy (
  employee_id,
  paid_hours_policy_id,
  effective_from,
  effective_to
)
SELECT
  e.id,
  php.id,
  DATE '2026-01-01',
  NULL
FROM employee e
JOIN paid_hours_policy php ON php.policy_code = 'STD_8H'
JOIN calendar_rule_set rs ON rs.id = php.rule_set_id
WHERE e.employee_number IN ('E1001', 'E2001', 'E3001')
  AND rs.rule_name = 'AU-NSW-BASELINE'
  AND rs.version_no = 1
ON CONFLICT DO NOTHING;

INSERT INTO leave_balance (
  employee_id,
  leave_code_id,
  as_of_date,
  balance_minutes
)
SELECT
  e.id,
  lc.id,
  DATE '2026-02-01',
  CASE lc.code
    WHEN 'AL' THEN 40 * 60
    WHEN 'SL' THEN 24 * 60
    WHEN 'PH' THEN 0
    ELSE 0
  END
FROM employee e
JOIN leave_code lc ON lc.code IN ('AL', 'SL', 'PH', 'LWOP')
WHERE e.employee_number IN ('E1001', 'E2001', 'E3001')
ON CONFLICT (employee_id, leave_code_id, as_of_date) DO UPDATE
SET balance_minutes = EXCLUDED.balance_minutes;

INSERT INTO seed_history (seed_key, checksum_sha256)
VALUES ('S006', repeat('f', 64))
ON CONFLICT (seed_key) DO UPDATE
SET
  checksum_sha256 = EXCLUDED.checksum_sha256,
  applied_at = now();

COMMIT;
