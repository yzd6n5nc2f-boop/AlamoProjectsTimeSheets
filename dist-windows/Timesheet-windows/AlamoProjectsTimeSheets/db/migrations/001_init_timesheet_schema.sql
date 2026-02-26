-- Timesheet schema bootstrap
-- Product: Timesheet (for Alamo Projects)
-- Footer in UI/docs: Innoweb Ventures Limited

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE workflow_status AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'MANAGER_APPROVED',
  'MANAGER_REJECTED',
  'PAYROLL_VALIDATED',
  'LOCKED'
);

CREATE TYPE period_status AS ENUM ('OPEN', 'IN_REVISION', 'LOCKED');

CREATE TYPE approval_action AS ENUM (
  'SUBMIT',
  'MANAGER_APPROVE',
  'MANAGER_REJECT',
  'PAYROLL_VALIDATE',
  'LOCK',
  'UNLOCK',
  'RETURN_FOR_CORRECTION'
);

CREATE TYPE leave_ledger_entry_type AS ENUM (
  'OPENING_BALANCE',
  'ACCRUAL',
  'CONSUMPTION',
  'ADJUSTMENT',
  'CARRY_FORWARD',
  'EXPIRY'
);

CREATE TYPE export_batch_status AS ENUM (
  'GENERATED',
  'DOWNLOADED',
  'ARCHIVED',
  'FAILED'
);

CREATE TYPE export_format AS ENUM ('CSV', 'XLSX', 'BOTH');

CREATE TYPE exception_severity AS ENUM ('ERROR', 'WARNING');

CREATE TABLE employee (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_number TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email CITEXT NOT NULL,
  manager_employee_id BIGINT NULL REFERENCES employee(id) ON DELETE SET NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  hired_on DATE NULL,
  terminated_on DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_employee_employee_number UNIQUE (employee_number),
  CONSTRAINT ux_employee_email UNIQUE (email),
  CONSTRAINT ck_employee_dates CHECK (
    terminated_on IS NULL OR hired_on IS NULL OR terminated_on >= hired_on
  )
);
CREATE INDEX idx_employee_manager ON employee(manager_employee_id);
CREATE INDEX idx_employee_active ON employee(active);

CREATE TABLE calendar_rule_set (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rule_name TEXT NOT NULL,
  version_no INT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ NULL,
  created_by BIGINT NULL REFERENCES employee(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_calendar_rule_set UNIQUE (rule_name, version_no),
  CONSTRAINT ck_calendar_rule_dates CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  )
);
CREATE INDEX idx_calendar_rule_set_effective
  ON calendar_rule_set(effective_from, effective_to);

CREATE TABLE calendar_public_holiday (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rule_set_id BIGINT NOT NULL REFERENCES calendar_rule_set(id) ON DELETE RESTRICT,
  holiday_date DATE NOT NULL,
  holiday_name TEXT NOT NULL,
  region_code TEXT NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_public_holiday UNIQUE (rule_set_id, holiday_date, region_code)
);
CREATE INDEX idx_public_holiday_date ON calendar_public_holiday(holiday_date);

CREATE TABLE calendar_special_day_rule (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rule_set_id BIGINT NOT NULL REFERENCES calendar_rule_set(id) ON DELETE RESTRICT,
  rule_kind TEXT NOT NULL,
  day_type_code TEXT NOT NULL,
  weekday SMALLINT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  paid_minutes INT NOT NULL DEFAULT 0,
  normal_minutes_cap INT NULL,
  overtime_after_minutes INT NULL,
  priority SMALLINT NOT NULL DEFAULT 100,
  conditions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_special_day_weekday CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6),
  CONSTRAINT ck_special_day_dates CHECK (
    end_date IS NULL OR start_date IS NULL OR end_date >= start_date
  ),
  CONSTRAINT ck_special_day_times CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);
CREATE INDEX idx_special_day_rule_lookup
  ON calendar_special_day_rule(rule_set_id, rule_kind, weekday, priority)
  WHERE active = TRUE;

CREATE TABLE paid_hours_policy (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rule_set_id BIGINT NOT NULL REFERENCES calendar_rule_set(id) ON DELETE RESTRICT,
  policy_code TEXT NOT NULL,
  policy_name TEXT NOT NULL,
  daily_normal_minutes INT NOT NULL,
  weekly_normal_minutes INT NOT NULL,
  friday_normal_minutes INT NULL,
  min_break_minutes INT NOT NULL DEFAULT 0,
  auto_break_after_minutes INT NULL,
  rounding_increment_minutes SMALLINT NOT NULL DEFAULT 15,
  overtime_daily_after_minutes INT NULL,
  overtime_weekly_after_minutes INT NULL,
  ph_counts_as_ot BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_paid_hours_policy UNIQUE (rule_set_id, policy_code),
  CONSTRAINT ck_paid_hours_nonnegative CHECK (
    daily_normal_minutes >= 0 AND
    weekly_normal_minutes >= 0 AND
    min_break_minutes >= 0
  )
);
CREATE INDEX idx_paid_policy_default ON paid_hours_policy(rule_set_id, is_default);

CREATE TABLE employee_paid_hours_policy (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE RESTRICT,
  paid_hours_policy_id BIGINT NOT NULL REFERENCES paid_hours_policy(id) ON DELETE RESTRICT,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_employee_policy_dates CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  )
);
CREATE INDEX idx_employee_policy_lookup
  ON employee_paid_hours_policy(employee_id, effective_from, effective_to);

CREATE TABLE leave_code (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT TRUE,
  accrues BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  export_earning_code TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_leave_code UNIQUE (code)
);
CREATE INDEX idx_leave_code_active ON leave_code(active);

CREATE TABLE timesheet_period (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  submission_open_at TIMESTAMPTZ NOT NULL,
  submission_close_at TIMESTAMPTZ NOT NULL,
  lock_at TIMESTAMPTZ NULL,
  period_status period_status NOT NULL DEFAULT 'OPEN',
  rule_set_id BIGINT NOT NULL REFERENCES calendar_rule_set(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_timesheet_period_range UNIQUE (period_start, period_end),
  CONSTRAINT ck_period_dates CHECK (period_end >= period_start),
  CONSTRAINT ck_period_windows CHECK (submission_close_at >= submission_open_at)
);
ALTER TABLE timesheet_period
  ADD CONSTRAINT ex_timesheet_period_no_overlap
  EXCLUDE USING gist (daterange(period_start, period_end, '[]') WITH &&);
CREATE INDEX idx_timesheet_period_status ON timesheet_period(period_status);

CREATE TABLE timesheet_header (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE RESTRICT,
  period_id BIGINT NOT NULL REFERENCES timesheet_period(id) ON DELETE RESTRICT,
  approver_employee_id BIGINT NULL REFERENCES employee(id) ON DELETE RESTRICT,
  workflow_status workflow_status NOT NULL DEFAULT 'DRAFT',
  revision_no INT NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  supersedes_header_id BIGINT NULL REFERENCES timesheet_header(id) ON DELETE RESTRICT,
  rule_set_id BIGINT NOT NULL REFERENCES calendar_rule_set(id) ON DELETE RESTRICT,
  paid_hours_policy_id BIGINT NOT NULL REFERENCES paid_hours_policy(id) ON DELETE RESTRICT,
  rule_snapshot_hash CHAR(64) NOT NULL,
  submitted_at TIMESTAMPTZ NULL,
  manager_decided_at TIMESTAMPTZ NULL,
  payroll_validated_at TIMESTAMPTZ NULL,
  locked_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL,
  manager_ot_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  manager_ph_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  total_normal_minutes INT NOT NULL DEFAULT 0,
  total_ot_minutes INT NOT NULL DEFAULT 0,
  total_ph_worked_minutes INT NOT NULL DEFAULT 0,
  total_leave_minutes INT NOT NULL DEFAULT 0,
  total_paid_minutes INT NOT NULL DEFAULT 0,
  row_version INT NOT NULL DEFAULT 1,
  created_by BIGINT NULL REFERENCES employee(id) ON DELETE SET NULL,
  updated_by BIGINT NULL REFERENCES employee(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_header_revision UNIQUE (employee_id, period_id, revision_no),
  CONSTRAINT ck_header_reject_reason CHECK (
    workflow_status <> 'MANAGER_REJECTED' OR rejection_reason IS NOT NULL
  ),
  CONSTRAINT ck_header_totals_nonnegative CHECK (
    total_normal_minutes >= 0 AND
    total_ot_minutes >= 0 AND
    total_ph_worked_minutes >= 0 AND
    total_leave_minutes >= 0 AND
    total_paid_minutes >= 0
  )
);
CREATE UNIQUE INDEX ux_header_current_per_period_employee
  ON timesheet_header(employee_id, period_id)
  WHERE is_current = TRUE;
CREATE INDEX idx_header_employee_status ON timesheet_header(employee_id, workflow_status);
CREATE INDEX idx_header_period_status ON timesheet_header(period_id, workflow_status);
CREATE INDEX idx_header_manager_queue
  ON timesheet_header(approver_employee_id, submitted_at)
  WHERE workflow_status = 'SUBMITTED' AND is_current = TRUE;
CREATE INDEX idx_header_payroll_queue
  ON timesheet_header(period_id, manager_decided_at)
  WHERE workflow_status = 'MANAGER_APPROVED' AND is_current = TRUE;

CREATE TABLE timesheet_day_entry (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  timesheet_header_id BIGINT NOT NULL REFERENCES timesheet_header(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  line_no SMALLINT NOT NULL DEFAULT 1,
  day_type_code TEXT NOT NULL,
  start_local TIME NULL,
  end_local TIME NULL,
  break_minutes INT NOT NULL DEFAULT 0,
  leave_code_id BIGINT NULL REFERENCES leave_code(id) ON DELETE RESTRICT,
  notes TEXT NULL,
  normal_minutes INT NOT NULL DEFAULT 0,
  ot_minutes INT NOT NULL DEFAULT 0,
  ph_worked_minutes INT NOT NULL DEFAULT 0,
  leave_minutes INT NOT NULL DEFAULT 0,
  paid_minutes INT NOT NULL DEFAULT 0,
  calc_trace JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_day_entry UNIQUE (timesheet_header_id, work_date, line_no),
  CONSTRAINT ck_day_entry_break_nonnegative CHECK (break_minutes >= 0),
  CONSTRAINT ck_day_entry_line_positive CHECK (line_no > 0),
  CONSTRAINT ck_day_entry_time_pair CHECK (
    (start_local IS NULL AND end_local IS NULL) OR
    (start_local IS NOT NULL AND end_local IS NOT NULL AND end_local > start_local)
  ),
  CONSTRAINT ck_day_entry_work_or_leave CHECK (
    NOT (leave_code_id IS NOT NULL AND start_local IS NOT NULL)
  ),
  CONSTRAINT ck_day_entry_minutes_nonnegative CHECK (
    normal_minutes >= 0 AND
    ot_minutes >= 0 AND
    ph_worked_minutes >= 0 AND
    leave_minutes >= 0 AND
    paid_minutes >= 0
  )
);
CREATE INDEX idx_day_entry_header_date ON timesheet_day_entry(timesheet_header_id, work_date);
CREATE INDEX idx_day_entry_leave_code ON timesheet_day_entry(leave_code_id);

CREATE TABLE approval_record (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  timesheet_header_id BIGINT NOT NULL REFERENCES timesheet_header(id) ON DELETE CASCADE,
  action approval_action NOT NULL,
  from_status workflow_status NULL,
  to_status workflow_status NULL,
  actor_employee_id BIGINT NULL REFERENCES employee(id) ON DELETE SET NULL,
  reason TEXT NULL,
  ot_confirmed BOOLEAN NULL,
  ph_confirmed BOOLEAN NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_approval_reject_reason CHECK (
    action <> 'MANAGER_REJECT' OR reason IS NOT NULL
  )
);
CREATE INDEX idx_approval_header_time
  ON approval_record(timesheet_header_id, action_at DESC);
CREATE INDEX idx_approval_actor_time
  ON approval_record(actor_employee_id, action_at DESC);

CREATE TABLE timesheet_exception (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  timesheet_header_id BIGINT NOT NULL REFERENCES timesheet_header(id) ON DELETE CASCADE,
  severity exception_severity NOT NULL,
  rule_code TEXT NOT NULL,
  field_path TEXT NULL,
  message TEXT NOT NULL,
  is_blocking BOOLEAN NOT NULL,
  source_stage TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ NULL,
  resolved_by BIGINT NULL REFERENCES employee(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_exception_open
  ON timesheet_exception(timesheet_header_id, is_resolved, is_blocking);
CREATE INDEX idx_exception_stage
  ON timesheet_exception(source_stage, is_resolved);

CREATE TABLE leave_balance (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE RESTRICT,
  leave_code_id BIGINT NOT NULL REFERENCES leave_code(id) ON DELETE RESTRICT,
  as_of_date DATE NOT NULL,
  balance_minutes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_leave_balance_snapshot UNIQUE (employee_id, leave_code_id, as_of_date)
);
CREATE INDEX idx_leave_balance_latest
  ON leave_balance(employee_id, leave_code_id, as_of_date DESC);

CREATE TABLE leave_ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE RESTRICT,
  leave_code_id BIGINT NOT NULL REFERENCES leave_code(id) ON DELETE RESTRICT,
  timesheet_day_entry_id BIGINT NULL REFERENCES timesheet_day_entry(id) ON DELETE SET NULL,
  period_id BIGINT NULL REFERENCES timesheet_period(id) ON DELETE SET NULL,
  entry_type leave_ledger_entry_type NOT NULL,
  minutes_delta INT NOT NULL,
  balance_after_minutes BIGINT NOT NULL,
  effective_date DATE NOT NULL,
  reason TEXT NULL,
  created_by BIGINT NULL REFERENCES employee(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_leave_ledger_delta_nonzero CHECK (minutes_delta <> 0)
);
CREATE INDEX idx_leave_ledger_emp_code_date
  ON leave_ledger(employee_id, leave_code_id, effective_date, id);
CREATE INDEX idx_leave_ledger_day_entry ON leave_ledger(timesheet_day_entry_id);

CREATE TABLE project (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_code TEXT NOT NULL,
  project_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  start_date DATE NULL,
  end_date DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_project_code UNIQUE (project_code),
  CONSTRAINT ck_project_dates CHECK (
    end_date IS NULL OR start_date IS NULL OR end_date >= start_date
  )
);
CREATE INDEX idx_project_active ON project(active);

CREATE TABLE cost_code (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cost_code TEXT NOT NULL,
  description TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_cost_code UNIQUE (cost_code)
);
CREATE INDEX idx_cost_code_active ON cost_code(active);

CREATE TABLE project_cost_code (
  project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE RESTRICT,
  cost_code_id BIGINT NOT NULL REFERENCES cost_code(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, cost_code_id)
);
CREATE INDEX idx_project_cost_code_cc ON project_cost_code(cost_code_id);

CREATE TABLE timesheet_allocation (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  day_entry_id BIGINT NOT NULL REFERENCES timesheet_day_entry(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE RESTRICT,
  cost_code_id BIGINT NULL REFERENCES cost_code(id) ON DELETE RESTRICT,
  allocation_percent NUMERIC(5,2) NULL,
  allocated_minutes INT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_allocation UNIQUE (day_entry_id, project_id, cost_code_id),
  CONSTRAINT ck_allocation_mode CHECK (
    (allocation_percent IS NOT NULL AND allocated_minutes IS NULL) OR
    (allocation_percent IS NULL AND allocated_minutes IS NOT NULL)
  ),
  CONSTRAINT ck_allocation_values CHECK (
    (allocation_percent IS NULL OR (allocation_percent > 0 AND allocation_percent <= 100)) AND
    (allocated_minutes IS NULL OR allocated_minutes > 0)
  )
);
CREATE INDEX idx_allocation_day_entry ON timesheet_allocation(day_entry_id);
CREATE INDEX idx_allocation_project ON timesheet_allocation(project_id);

CREATE TABLE payroll_export_batch (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id TEXT NOT NULL,
  period_id BIGINT NOT NULL REFERENCES timesheet_period(id) ON DELETE RESTRICT,
  status export_batch_status NOT NULL DEFAULT 'GENERATED',
  export_format export_format NOT NULL DEFAULT 'BOTH',
  line_count INT NOT NULL DEFAULT 0,
  generated_by BIGINT NULL REFERENCES employee(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rule_set_id BIGINT NOT NULL REFERENCES calendar_rule_set(id) ON DELETE RESTRICT,
  csv_uri TEXT NULL,
  xlsx_uri TEXT NULL,
  checksum_sha256 CHAR(64) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_export_batch_id UNIQUE (batch_id)
);
CREATE INDEX idx_export_batch_period_status
  ON payroll_export_batch(period_id, status);
CREATE INDEX idx_export_batch_generated_at
  ON payroll_export_batch(generated_at DESC);

CREATE TABLE payroll_export_line (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payroll_export_batch_id BIGINT NOT NULL REFERENCES payroll_export_batch(id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  timesheet_header_id BIGINT NOT NULL REFERENCES timesheet_header(id) ON DELETE RESTRICT,
  employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE RESTRICT,
  work_date DATE NULL,
  earnings_code TEXT NOT NULL,
  project_code TEXT NULL,
  cost_code TEXT NULL,
  normal_minutes INT NOT NULL DEFAULT 0,
  ot_minutes INT NOT NULL DEFAULT 0,
  ph_worked_minutes INT NOT NULL DEFAULT 0,
  leave_minutes INT NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_export_line_no UNIQUE (payroll_export_batch_id, line_no),
  CONSTRAINT ck_export_line_minutes_nonnegative CHECK (
    normal_minutes >= 0 AND
    ot_minutes >= 0 AND
    ph_worked_minutes >= 0 AND
    leave_minutes >= 0
  )
);
CREATE INDEX idx_export_line_batch ON payroll_export_line(payroll_export_batch_id);
CREATE INDEX idx_export_line_header ON payroll_export_line(timesheet_header_id);

CREATE TABLE audit_event (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_table TEXT NOT NULL,
  entity_pk TEXT NOT NULL,
  operation TEXT NOT NULL,
  actor_employee_id BIGINT NULL REFERENCES employee(id) ON DELETE SET NULL,
  actor_role TEXT NULL,
  request_id UUID NULL,
  correlation_id UUID NULL,
  reason TEXT NULL,
  source TEXT NOT NULL DEFAULT 'api',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  prev_event_hash BYTEA NULL,
  event_hash BYTEA NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity_time
  ON audit_event(entity_table, entity_pk, occurred_at DESC);
CREATE INDEX idx_audit_actor_time
  ON audit_event(actor_employee_id, occurred_at DESC);
CREATE INDEX idx_audit_request ON audit_event(request_id);
CREATE UNIQUE INDEX ux_audit_event_hash ON audit_event(event_hash);

CREATE TABLE audit_field_change (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  audit_event_id BIGINT NOT NULL REFERENCES audit_event(id) ON DELETE CASCADE,
  field_path TEXT NOT NULL,
  old_value JSONB NULL,
  new_value JSONB NULL,
  is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  old_value_hash BYTEA NULL,
  new_value_hash BYTEA NULL,
  CONSTRAINT ux_audit_field_once UNIQUE (audit_event_id, field_path)
);
CREATE INDEX idx_audit_field_path ON audit_field_change(field_path);

COMMIT;
