BEGIN;

ALTER TABLE calendar_rule_set
  ADD CONSTRAINT ex_calendar_rule_set_no_overlap
  EXCLUDE USING gist (
    rule_name WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
  );

ALTER TABLE employee_paid_hours_policy
  ADD CONSTRAINT ex_employee_paid_hours_policy_no_overlap
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
  );

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
    CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT ck_leave_code_policy_nonnegative
    CHECK (paid_minutes_per_day >= 0)
);

ALTER TABLE leave_code_policy
  ADD CONSTRAINT ex_leave_code_policy_no_overlap
  EXCLUDE USING gist (
    leave_code_id WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
  );

CREATE INDEX idx_leave_code_policy_lookup
  ON leave_code_policy(leave_code_id, rule_set_id, effective_from, effective_to);

COMMIT;
