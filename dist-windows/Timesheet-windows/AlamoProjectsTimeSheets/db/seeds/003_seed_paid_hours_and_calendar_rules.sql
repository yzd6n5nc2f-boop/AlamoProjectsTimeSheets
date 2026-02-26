BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('timesheet-seed-lock', 0));

INSERT INTO calendar_rule_set (
  rule_name,
  version_no,
  effective_from,
  effective_to,
  timezone,
  is_published,
  published_at,
  created_by
)
SELECT
  'AU-NSW-BASELINE',
  1,
  DATE '2026-01-01',
  NULL,
  'Australia/Sydney',
  TRUE,
  now(),
  e.id
FROM employee e
WHERE e.employee_number = 'ADM0001'
ON CONFLICT (rule_name, version_no) DO UPDATE
SET
  effective_from = EXCLUDED.effective_from,
  effective_to = EXCLUDED.effective_to,
  timezone = EXCLUDED.timezone,
  is_published = EXCLUDED.is_published,
  published_at = EXCLUDED.published_at;

INSERT INTO paid_hours_policy (
  rule_set_id,
  policy_code,
  policy_name,
  daily_normal_minutes,
  weekly_normal_minutes,
  friday_normal_minutes,
  min_break_minutes,
  auto_break_after_minutes,
  rounding_increment_minutes,
  overtime_daily_after_minutes,
  overtime_weekly_after_minutes,
  ph_counts_as_ot,
  is_default
)
SELECT
  rs.id,
  'STD_8H',
  'Standard 8h day / 40h week',
  480,
  2400,
  360,
  30,
  360,
  15,
  480,
  2400,
  TRUE,
  TRUE
FROM calendar_rule_set rs
WHERE rs.rule_name = 'AU-NSW-BASELINE' AND rs.version_no = 1
ON CONFLICT (rule_set_id, policy_code) DO UPDATE
SET
  policy_name = EXCLUDED.policy_name,
  daily_normal_minutes = EXCLUDED.daily_normal_minutes,
  weekly_normal_minutes = EXCLUDED.weekly_normal_minutes,
  friday_normal_minutes = EXCLUDED.friday_normal_minutes,
  min_break_minutes = EXCLUDED.min_break_minutes,
  auto_break_after_minutes = EXCLUDED.auto_break_after_minutes,
  rounding_increment_minutes = EXCLUDED.rounding_increment_minutes,
  overtime_daily_after_minutes = EXCLUDED.overtime_daily_after_minutes,
  overtime_weekly_after_minutes = EXCLUDED.overtime_weekly_after_minutes,
  ph_counts_as_ot = EXCLUDED.ph_counts_as_ot,
  is_default = EXCLUDED.is_default;

INSERT INTO calendar_special_day_rule (
  rule_set_id,
  rule_kind,
  day_type_code,
  weekday,
  paid_minutes,
  normal_minutes_cap,
  overtime_after_minutes,
  priority,
  conditions_json,
  active
)
SELECT
  rs.id,
  'WEEKDAY_DEFAULT',
  'WORKDAY',
  d.weekday,
  480,
  480,
  480,
  100,
  '{}'::jsonb,
  TRUE
FROM calendar_rule_set rs
CROSS JOIN (VALUES (1), (2), (3), (4)) AS d(weekday)
WHERE rs.rule_name = 'AU-NSW-BASELINE' AND rs.version_no = 1
ON CONFLICT DO NOTHING;

INSERT INTO calendar_special_day_rule (
  rule_set_id,
  rule_kind,
  day_type_code,
  weekday,
  paid_minutes,
  normal_minutes_cap,
  overtime_after_minutes,
  priority,
  conditions_json,
  active
)
SELECT
  rs.id,
  'FRIDAY_SHORT_DAY',
  'FRIDAY_SHORT_DAY',
  5,
  480,
  360,
  360,
  90,
  '{"short_day": true}'::jsonb,
  TRUE
FROM calendar_rule_set rs
WHERE rs.rule_name = 'AU-NSW-BASELINE' AND rs.version_no = 1
ON CONFLICT DO NOTHING;

INSERT INTO calendar_special_day_rule (
  rule_set_id,
  rule_kind,
  day_type_code,
  weekday,
  paid_minutes,
  normal_minutes_cap,
  overtime_after_minutes,
  priority,
  conditions_json,
  active
)
SELECT
  rs.id,
  'EARLY_KNOCK_OFF',
  'EARLY_KNOCK_OFF',
  4,
  480,
  480,
  480,
  80,
  '{"early_knock_off": true, "paid_full_day": true}'::jsonb,
  TRUE
FROM calendar_rule_set rs
WHERE rs.rule_name = 'AU-NSW-BASELINE' AND rs.version_no = 1
ON CONFLICT DO NOTHING;

INSERT INTO leave_code_policy (
  leave_code_id,
  rule_set_id,
  paid_minutes_per_day,
  is_paid,
  effective_from,
  effective_to
)
SELECT
  lc.id,
  rs.id,
  CASE WHEN lc.code = 'LWOP' THEN 0 ELSE 480 END,
  lc.is_paid,
  DATE '2026-01-01',
  NULL
FROM leave_code lc
JOIN calendar_rule_set rs ON rs.rule_name = 'AU-NSW-BASELINE' AND rs.version_no = 1
ON CONFLICT DO NOTHING;

INSERT INTO seed_history (seed_key, checksum_sha256)
VALUES ('S003', repeat('c', 64))
ON CONFLICT (seed_key) DO UPDATE
SET
  checksum_sha256 = EXCLUDED.checksum_sha256,
  applied_at = now();

COMMIT;
