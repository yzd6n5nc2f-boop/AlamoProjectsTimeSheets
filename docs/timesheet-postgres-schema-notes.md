# Timesheet Postgres Schema Notes

Product: **Timesheet**  
Subtitle: **for Alamo Projects**  
Footer standard: **Innoweb Ventures Limited**

## Tables covered

- `employee` (unique `employee_number`)
- `timesheet_period`
- `timesheet_header`
- `timesheet_day_entry`
- `approval_record`
- `leave_balance`
- `leave_ledger`
- Calendar rules:
  - `calendar_rule_set`
  - `calendar_public_holiday`
  - `calendar_special_day_rule`
  - `paid_hours_policy`
  - `employee_paid_hours_policy`
- Payroll export:
  - `payroll_export_batch`
  - `payroll_export_line`
- Project/cost model-ready:
  - `project`
  - `cost_code`
  - `project_cost_code`
  - `timesheet_allocation`
- Field-level audit:
  - `audit_event`
  - `audit_field_change`

## Referential integrity highlights

- Every `timesheet_header` belongs to exactly one `employee` and one `timesheet_period`.
- Every `timesheet_day_entry` belongs to exactly one `timesheet_header`.
- `approval_record` provides append-only workflow trail per `timesheet_header`.
- Leave consumption can link back to `timesheet_day_entry` through `leave_ledger`.
- Export lines are immutable denormalized snapshots by batch (`payroll_export_line`).
- `timesheet_period` prevents date overlaps using a range exclusion constraint.

## Audit strategy recommendation

Use hybrid append-only auditing:

1. `audit_event`: immutable event envelope (`who`, `when`, `what entity`, `operation`, `reason`, hash chain fields).
2. `audit_field_change`: immutable field-level before/after diffs per event.

Why hybrid:

- Event-only is strong for forensics but weaker for field analysis.
- Diff-only is easier for field reporting but weaker for context.
- Combined model gives forensic strength and operational queryability.

Guard rails included in migration:

- Trigger-based block on `UPDATE/DELETE` for audit tables.
- Locked timesheet headers/day entries are immutable.

## Historical correctness when rules change

1. Version rules in `calendar_rule_set`; do not mutate published versions.
2. Pin period and header to rule version (`rule_set_id`) and policy (`paid_hours_policy_id`).
3. Persist computed values on day/header rows; do not recalculate locked historical data in place.
4. Keep revisions as new `timesheet_header` rows (`revision_no`, `supersedes_header_id`, `is_current`).
5. Keep `leave_ledger` append-only with `balance_after_minutes`.
6. Export from stored batch snapshots so historical payroll files are reproducible.
