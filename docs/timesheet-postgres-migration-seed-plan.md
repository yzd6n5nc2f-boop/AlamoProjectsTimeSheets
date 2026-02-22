# Timesheet Postgres Migration and Seed Plan

Product: **Timesheet**  
Subtitle: **for Alamo Projects**  
Footer requirement for UI/PDF outputs: **Innoweb Ventures Limited**

## 1) Migration List (Dependency Order)

This order assumes the current repository baseline already has:

- `001_init_timesheet_schema.sql`
- `002_guards_and_triggers.sql`

Recommended additional migrations:

| Order | Migration file | Depends on | Purpose |
|---|---|---|---|
| 001 | `001_init_timesheet_schema.sql` | None | Core domain schema (employee, periods, timesheets, rules, leave, export, audit). |
| 002 | `002_guards_and_triggers.sql` | 001 | `updated_at` triggers, audit append-only protection, locked-record mutation guards. |
| 003 | `003_auth_rbac.sql` | 001 | Add RBAC and auth persistence tables (roles, role assignment, credentials, refresh sessions). |
| 004 | `004_effective_dating_constraints.sql` | 001,003 | Add non-overlap effective-dating constraints and leave code policy table. |
| 005 | `005_idempotency_keys.sql` | 001,003 | Add idempotency key store for mutation endpoints. |
| 006 | `006_seed_registry.sql` | 001 | Add seed history table to track seed idempotency/checksums. |
| 007 | `007_reporting_views.sql` | 001,004,005 | Add operational views for manager/payroll/audit dashboards. |

## 2) Effective-Dating Strategy for Rule Changes

### 2.1 Principles

1. Published rule versions are immutable.
2. New policy changes create new effective-dated rows/version, never in-place edits.
3. Historical correctness is preserved because:
  - `timesheet_period.rule_set_id` is pinned.
  - `timesheet_header.rule_set_id` and `paid_hours_policy_id` are pinned.
  - Computed minutes are persisted and not recomputed for locked periods.

### 2.2 Non-overlap constraints

Use exclusion constraints to prevent overlapping effective windows for the same key.

```sql
-- calendar_rule_set no overlap by rule_name
ALTER TABLE calendar_rule_set
  ADD CONSTRAINT ex_calendar_rule_set_no_overlap
  EXCLUDE USING gist (
    rule_name WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
  );

-- employee_paid_hours_policy no overlap per employee
ALTER TABLE employee_paid_hours_policy
  ADD CONSTRAINT ex_employee_paid_hours_policy_no_overlap
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
  );
```

### 2.3 Leave paid-hours effective-dating

Add a policy table instead of mutating `leave_code` behavior historically.

```sql
CREATE TABLE leave_code_policy (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  leave_code_id BIGINT NOT NULL REFERENCES leave_code(id) ON DELETE RESTRICT,
  rule_set_id BIGINT NOT NULL REFERENCES calendar_rule_set(id) ON DELETE RESTRICT,
  paid_minutes_per_day INT NOT NULL DEFAULT 480,
  is_paid BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_leave_code_policy_dates
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

ALTER TABLE leave_code_policy
  ADD CONSTRAINT ex_leave_code_policy_no_overlap
  EXCLUDE USING gist (
    leave_code_id WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
  );
```

## 3) Reference Data Keys and Constraints

Use natural keys for idempotent seeds:

| Entity | Natural key | Constraint |
|---|---|---|
| Employee | `employee_number` | unique (`ux_employee_employee_number`) |
| Role (new) | `role_code` | unique |
| Employee role map (new) | `(employee_id, role_id)` | primary key |
| Rule set | `(rule_name, version_no)` | unique |
| Public holiday | `(rule_set_id, holiday_date, region_code)` | unique |
| Paid hours policy | `(rule_set_id, policy_code)` | unique |
| Leave code | `code` | unique |
| Period | `(period_start, period_end)` | unique + non-overlap exclusion |
| Export batch | `batch_id` | unique |

## 4) Sample SQL Migration Approach

### 4.1 `003_auth_rbac.sql` (sample)

```sql
BEGIN;

CREATE TABLE app_role (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_code TEXT NOT NULL UNIQUE,
  role_name TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employee_role (
  employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES app_role(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by BIGINT NULL REFERENCES employee(id) ON DELETE SET NULL,
  PRIMARY KEY (employee_id, role_id)
);
CREATE INDEX idx_employee_role_role ON employee_role(role_id);

CREATE TABLE auth_credential (
  employee_id BIGINT PRIMARY KEY REFERENCES employee(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  password_algo TEXT NOT NULL DEFAULT 'argon2id',
  password_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  must_reset BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE refresh_session (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  token_family UUID NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  replaced_by_session_id BIGINT NULL REFERENCES refresh_session(id) ON DELETE SET NULL,
  ip INET NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_session_active
  ON refresh_session(employee_id, expires_at)
  WHERE revoked_at IS NULL;

COMMIT;
```

### 4.2 `005_idempotency_keys.sql` (sample)

```sql
BEGIN;

CREATE TABLE idempotency_key (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  actor_employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response_status INT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT ux_idempotency UNIQUE (idempotency_key, actor_employee_id, method, path)
);

CREATE INDEX idx_idempotency_expiry ON idempotency_key(expires_at);

COMMIT;
```

### 4.3 `006_seed_registry.sql` (sample)

```sql
BEGIN;

CREATE TABLE seed_history (
  seed_key TEXT PRIMARY KEY,
  checksum_sha256 CHAR(64) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
```

## 5) Seed Plan (Idempotent, Ordered)

Recommended seed script order:

| Order | Seed file | Depends on | Contains |
|---|---|---|---|
| S001 | `001_seed_roles_and_admin.sql` | 003 | Roles, admin employee, sample employees, role assignments, auth credentials placeholders. |
| S002 | `002_seed_leave_codes.sql` | 001,004 | Leave/absence codes and leave policy defaults. |
| S003 | `003_seed_paid_hours_and_calendar_rules.sql` | 001,004 | Baseline ruleset, special day rules, paid-hours policies. |
| S004 | `004_seed_public_holidays.sql` | 001 | Public holiday dates. |
| S005 | `005_seed_sample_period.sql` | 001,S003 | One sample period linked to baseline ruleset. |
| S006 | `006_seed_sample_employees_policy_assignments.sql` | 001,S001,S003 | Employee policy assignment and sample leave balances. |

### 5.1 Idempotent seed approach

1. Acquire advisory transaction lock to avoid concurrent seed execution.
2. Upsert by natural keys (`ON CONFLICT DO UPDATE/DO NOTHING`).
3. Track script application in `seed_history` by `seed_key` + checksum.
4. Do not delete reference rows in production seeds; deactivate/supersede instead.

Common seed prelude:

```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('timesheet-seed-lock', 0));
-- run upserts
COMMIT;
```

## 6) Seed Dataset Example (SQL)

### 6.1 Roles + admin + sample employees

```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('timesheet-seed-lock', 0));

INSERT INTO app_role (role_code, role_name)
VALUES
  ('ADMIN', 'Administrator'),
  ('EMPLOYEE', 'Employee'),
  ('MANAGER', 'Manager'),
  ('PAYROLL', 'Payroll')
ON CONFLICT (role_code) DO UPDATE
SET role_name = EXCLUDED.role_name;

INSERT INTO employee (employee_number, first_name, last_name, email, timezone, active)
VALUES
  ('ADM0001', 'System', 'Admin', 'admin@timesheet.local', 'Australia/Sydney', TRUE),
  ('E1001', 'Ana', 'Lee', 'ana.lee@timesheet.local', 'Australia/Sydney', TRUE),
  ('E2001', 'Marta', 'Ng', 'marta.ng@timesheet.local', 'Australia/Sydney', TRUE),
  ('E3001', 'Paul', 'Tran', 'paul.tran@timesheet.local', 'Australia/Sydney', TRUE)
ON CONFLICT (employee_number) DO UPDATE
SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  timezone = EXCLUDED.timezone,
  active = EXCLUDED.active;

-- Set manager relationship: E1001 reports to E2001
UPDATE employee e
SET manager_employee_id = m.id
FROM employee m
WHERE e.employee_number = 'E1001' AND m.employee_number = 'E2001';

-- Role assignment
INSERT INTO employee_role (employee_id, role_id)
SELECT e.id, r.id
FROM employee e
JOIN app_role r ON (
  (e.employee_number = 'ADM0001' AND r.role_code = 'ADMIN') OR
  (e.employee_number = 'ADM0001' AND r.role_code = 'EMPLOYEE') OR
  (e.employee_number = 'E1001' AND r.role_code = 'EMPLOYEE') OR
  (e.employee_number = 'E2001' AND r.role_code = 'MANAGER') OR
  (e.employee_number = 'E3001' AND r.role_code = 'PAYROLL')
)
ON CONFLICT DO NOTHING;

-- Credential placeholders (replace hashes with real Argon2id output)
INSERT INTO auth_credential (employee_id, password_hash, password_algo, must_reset)
SELECT id, 'REPLACE_WITH_ARGON2_HASH', 'argon2id', TRUE
FROM employee
WHERE employee_number IN ('ADM0001', 'E1001', 'E2001', 'E3001')
ON CONFLICT (employee_id) DO UPDATE
SET must_reset = EXCLUDED.must_reset;

COMMIT;
```

### 6.2 Leave codes + ruleset + paid hours + special day rules + PH dates + sample period

```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('timesheet-seed-lock', 0));

INSERT INTO leave_code (code, description, is_paid, accrues, active, export_earning_code)
VALUES
  ('PH', 'Public Holiday Not Worked', TRUE, FALSE, TRUE, 'LEAVE_PH'),
  ('AL', 'Annual Leave', TRUE, TRUE, TRUE, 'LEAVE_ANNUAL'),
  ('SL', 'Sick Leave', TRUE, TRUE, TRUE, 'LEAVE_SICK'),
  ('LWP', 'Leave Without Pay', FALSE, FALSE, TRUE, 'LEAVE_UNPAID')
ON CONFLICT (code) DO UPDATE
SET
  description = EXCLUDED.description,
  is_paid = EXCLUDED.is_paid,
  accrues = EXCLUDED.accrues,
  active = EXCLUDED.active,
  export_earning_code = EXCLUDED.export_earning_code;

INSERT INTO calendar_rule_set (
  rule_name, version_no, effective_from, effective_to, timezone, is_published, published_at
)
VALUES ('AU_STD', 1, DATE '2026-01-01', NULL, 'Australia/Sydney', TRUE, now())
ON CONFLICT (rule_name, version_no) DO UPDATE
SET
  timezone = EXCLUDED.timezone,
  is_published = EXCLUDED.is_published,
  published_at = EXCLUDED.published_at
RETURNING id;

INSERT INTO paid_hours_policy (
  rule_set_id, policy_code, policy_name, daily_normal_minutes, weekly_normal_minutes,
  friday_normal_minutes, min_break_minutes, rounding_increment_minutes,
  overtime_daily_after_minutes, overtime_weekly_after_minutes, ph_counts_as_ot, is_default
)
SELECT id, 'STD8', 'Standard 8h Day', 480, 2280, 360, 30, 15, 480, 2280, TRUE, TRUE
FROM calendar_rule_set
WHERE rule_name = 'AU_STD' AND version_no = 1
ON CONFLICT (rule_set_id, policy_code) DO UPDATE
SET
  policy_name = EXCLUDED.policy_name,
  daily_normal_minutes = EXCLUDED.daily_normal_minutes,
  weekly_normal_minutes = EXCLUDED.weekly_normal_minutes,
  friday_normal_minutes = EXCLUDED.friday_normal_minutes,
  min_break_minutes = EXCLUDED.min_break_minutes,
  rounding_increment_minutes = EXCLUDED.rounding_increment_minutes,
  overtime_daily_after_minutes = EXCLUDED.overtime_daily_after_minutes,
  overtime_weekly_after_minutes = EXCLUDED.overtime_weekly_after_minutes,
  ph_counts_as_ot = EXCLUDED.ph_counts_as_ot,
  is_default = EXCLUDED.is_default;

-- Friday short day
INSERT INTO calendar_special_day_rule (
  rule_set_id, rule_kind, day_type_code, weekday, normal_minutes_cap, paid_minutes, priority, active
)
SELECT id, 'FRIDAY_SHORT_DAY', 'FRI_SHORT', 5, 360, 360, 20, TRUE
FROM calendar_rule_set
WHERE rule_name = 'AU_STD' AND version_no = 1
ON CONFLICT DO NOTHING;

-- Early knock-off day, full-day paid
INSERT INTO calendar_special_day_rule (
  rule_set_id, rule_kind, day_type_code, start_date, end_date, paid_minutes, priority, active
)
SELECT id, 'EARLY_KNOCK_OFF', 'EKO', DATE '2026-12-24', DATE '2026-12-24', 480, 10, TRUE
FROM calendar_rule_set
WHERE rule_name = 'AU_STD' AND version_no = 1
ON CONFLICT DO NOTHING;

-- Sample PH dates
INSERT INTO calendar_public_holiday (
  rule_set_id, holiday_date, holiday_name, region_code, is_paid
)
SELECT id, DATE '2026-02-19', 'Founders Day', 'NSW', TRUE
FROM calendar_rule_set
WHERE rule_name = 'AU_STD' AND version_no = 1
ON CONFLICT (rule_set_id, holiday_date, region_code) DO UPDATE
SET
  holiday_name = EXCLUDED.holiday_name,
  is_paid = EXCLUDED.is_paid;

-- Sample period
INSERT INTO timesheet_period (
  period_name, period_start, period_end,
  submission_open_at, submission_close_at, lock_at, period_status, rule_set_id
)
SELECT
  '2026-W08',
  DATE '2026-02-16',
  DATE '2026-02-22',
  TIMESTAMPTZ '2026-02-16 00:00:00+00',
  TIMESTAMPTZ '2026-02-24 23:59:59+00',
  NULL,
  'OPEN',
  id
FROM calendar_rule_set
WHERE rule_name = 'AU_STD' AND version_no = 1
ON CONFLICT (period_start, period_end) DO UPDATE
SET
  period_name = EXCLUDED.period_name,
  submission_open_at = EXCLUDED.submission_open_at,
  submission_close_at = EXCLUDED.submission_close_at,
  period_status = EXCLUDED.period_status,
  rule_set_id = EXCLUDED.rule_set_id;

COMMIT;
```

### 6.3 Sample employee policy assignment and leave balances

```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('timesheet-seed-lock', 0));

INSERT INTO employee_paid_hours_policy (
  employee_id, paid_hours_policy_id, effective_from, effective_to
)
SELECT e.id, p.id, DATE '2026-01-01', NULL
FROM employee e
JOIN calendar_rule_set rs ON rs.rule_name = 'AU_STD' AND rs.version_no = 1
JOIN paid_hours_policy p ON p.rule_set_id = rs.id AND p.policy_code = 'STD8'
WHERE e.employee_number IN ('E1001', 'E2001', 'E3001')
ON CONFLICT DO NOTHING;

INSERT INTO leave_balance (employee_id, leave_code_id, as_of_date, balance_minutes)
SELECT e.id, lc.id, DATE '2026-02-16',
  CASE lc.code
    WHEN 'AL' THEN 4560  -- 76.00 hours
    WHEN 'SL' THEN 2400  -- 40.00 hours
    ELSE 0
  END
FROM employee e
JOIN leave_code lc ON lc.code IN ('AL', 'SL', 'LWP', 'PH')
WHERE e.employee_number = 'E1001'
ON CONFLICT (employee_id, leave_code_id, as_of_date) DO UPDATE
SET balance_minutes = EXCLUDED.balance_minutes;

COMMIT;
```

## 7) Seed Execution Sequence (Local/CI)

1. Apply migrations in order (`001` -> `007`).
2. Run seeds in order (`S001` -> `S006`).
3. Verify:
  - one open sample period exists
  - roles assigned
  - ruleset published
  - holiday date exists
  - leave balances available for sample employee

Suggested verification SQL:

```sql
SELECT period_name, period_status FROM timesheet_period WHERE period_start = DATE '2026-02-16';
SELECT employee_number, role_code
FROM employee e
JOIN employee_role er ON er.employee_id = e.id
JOIN app_role r ON r.id = er.role_id
ORDER BY employee_number, role_code;
```

