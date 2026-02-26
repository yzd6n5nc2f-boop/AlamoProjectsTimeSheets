BEGIN;

CREATE OR REPLACE VIEW vw_manager_queue AS
SELECT
  th.id AS timesheet_header_id,
  e.employee_number,
  e.first_name,
  e.last_name,
  th.period_id,
  th.workflow_status,
  th.submitted_at,
  th.total_normal_minutes,
  th.total_ot_minutes,
  th.total_ph_worked_minutes,
  th.total_leave_minutes,
  th.manager_ot_confirmed,
  th.manager_ph_confirmed
FROM timesheet_header th
JOIN employee e ON e.id = th.employee_id
WHERE th.workflow_status = 'SUBMITTED'
  AND th.is_current = TRUE;

CREATE OR REPLACE VIEW vw_payroll_exceptions AS
SELECT
  te.id AS exception_id,
  te.timesheet_header_id,
  th.period_id,
  e.employee_number,
  te.severity,
  te.rule_code,
  te.field_path,
  te.message,
  te.is_blocking,
  te.source_stage,
  te.is_resolved,
  te.created_at
FROM timesheet_exception te
JOIN timesheet_header th ON th.id = te.timesheet_header_id
JOIN employee e ON e.id = th.employee_id
WHERE te.is_resolved = FALSE;

CREATE OR REPLACE VIEW vw_export_readiness AS
SELECT
  th.id AS timesheet_header_id,
  th.period_id,
  th.employee_id,
  e.employee_number,
  th.workflow_status,
  th.total_paid_minutes,
  COUNT(te.*) FILTER (WHERE te.is_resolved = FALSE AND te.is_blocking = TRUE) AS blocking_exceptions,
  (th.workflow_status = 'PAYROLL_VALIDATED') AS workflow_ready
FROM timesheet_header th
JOIN employee e ON e.id = th.employee_id
LEFT JOIN timesheet_exception te ON te.timesheet_header_id = th.id
WHERE th.is_current = TRUE
GROUP BY th.id, th.period_id, th.employee_id, e.employee_number, th.workflow_status, th.total_paid_minutes;

COMMIT;
