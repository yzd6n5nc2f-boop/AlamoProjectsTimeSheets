# Timesheet MVP Architecture

Product brand: **Timesheet**  
Subtitle: **for Alamo Projects**  
Global footer (all UI and documents): **Innoweb Ventures Limited**

## 1) Confirmed Assumptions (Explicit)

- This document is the approved baseline to implement the MVP.
- Workflow states are fixed: `Draft -> Submitted -> Manager Approved/Rejected -> Payroll Validated -> Locked`.
- Rules are deterministic and configuration-driven (no heuristic/AI decision logic in core validation or approvals).
- Calendar, day-type, paid-hours, and leave codes are configurable without code changes.
- Audit requirements are field-level for all creates/updates/deletes plus workflow transitions.
- Locked periods are immutable except through controlled revision/unlock processes with full audit linkage.

## 2) MVP Scope (In/Out)

### In Scope

- Authentication and RBAC roles: Employee, Manager, Payroll, Admin.
- Employee timesheet entry by day:
  - Work entries (`start`, `finish`, optional breaks).
  - Leave/absence entries (code-based).
- Deterministic auto-calculation:
  - Normal hours.
  - Overtime (OT).
  - Public holiday worked (PH Worked).
  - Leave hours.
- Validation engine for deterministic checks:
  - Required fields.
  - Time overlap detection.
  - Daily/weekly caps.
  - Policy compatibility checks.
- Workflow operations:
  - Submit.
  - Manager approve/reject (rejection reason required).
  - Payroll validate.
  - Lock period.
- Payroll validation dashboard with exceptions queue and controlled correction flow.
- Export batch generation (`CSV` and `XLSX`) with unique batch ID and run metadata.
- Audit log UI/API with filter/search by user, field, entity, action, and date.

### Out of Scope (MVP)

- Native mobile apps.
- Biometric attendance and device integrations.
- Deep external payroll/ERP bidirectional sync (beyond file export).
- Predictive analytics and workforce forecasting.
- Complex multi-tenant billing/white-label operations.
- Automated rostering/scheduling optimization.

## 3) Key Policies as Configuration (Tables/Settings)

### Calendar and Day Types

- `calendar_periods`: pay periods, open/close windows, lock windows.
- `holiday_calendar`: public holidays per location/business unit.
- `day_type_rules`: classify days (workday/weekend/holiday/custom).

### Leave and Absence

- `leave_codes`: paid/unpaid flags, accrual behavior hooks, reporting classes.
- `absence_codes`: non-work categories with payroll mapping behavior.
- `leave_code_mapping`: mapping to export codes.

### Paid Hours and Breaks

- `paid_hours_profiles`: standard paid hours per day/week by group.
- `break_rules`: unpaid/paid break rules and rounding increments.

### OT and PH Worked

- `overtime_rules`: threshold logic, multiplier bands, eligibility constraints.
- `public_holiday_rules`: PH worked logic, premiums, fallback conditions.

### Deterministic Validation

- `validation_rules`: active checks, severity, rule parameters.
- `validation_messages`: standardized error/warning text.

### Workflow and Access

- `workflow_transitions`: allowed transitions by current state and target state.
- `workflow_permissions`: role-action mapping, reason-required flags.

### Locking and Controlled Revision

- `period_lock_policy`: lock timing and authority definitions.
- `revision_policy`: unlock authority, reason requirements, revision window.

### Export

- `export_profiles`: format presets and naming templates.
- `export_field_mapping`: deterministic field mapping and transforms.
- `export_batch_policy`: sequence strategy and uniqueness constraints.

### Audit

- `audit_policy`: entities/fields to capture and redaction policy where needed.
- `audit_retention`: retention windows and archival rules.

## 4) High-Level Architecture (React + Node/TS + Postgres)

### Frontend (React + TypeScript)

- Role-based app routes:
  - Employee Timesheet.
  - Manager Queue/Review.
  - Payroll Validation/Export.
  - Admin Config.
  - Audit Explorer.
- Shared layout enforces brand and footer:
  - Title: `Timesheet`.
  - Subtitle: `for Alamo Projects`.
  - Footer: `Innoweb Ventures Limited`.
- UI forms driven by policy snapshots from API to keep behavior deterministic.

### Backend (Node.js + TypeScript)

- Module boundaries:
  - `auth-service`
  - `timesheet-service`
  - `policy-engine`
  - `workflow-engine`
  - `payroll-export-service`
  - `audit-service`
- `policy-engine` executes versioned rule sets as pure functions over timesheet input.
- `workflow-engine` enforces finite-state transitions and actor permissions.
- All mutations include actor identity, timestamp, and reason metadata when required.

### Data Layer (Postgres)

- Core domain tables:
  - `users`, `roles`, `user_roles`
  - `timesheets`, `timesheet_rows`, `timesheet_day_summaries`
  - `workflow_events`
  - `export_batches`, `export_batch_items`
  - `config_*` policy tables
  - `audit_log`, `audit_field_changes`
- Data integrity:
  - Foreign keys on all relations.
  - Check constraints for state and numeric boundaries.
  - Unique constraints for one timesheet per employee/period.
- Audit model:
  - Entity-level event row.
  - Field-level before/after records linked by event ID.
  - Immutable event records.

### Determinism and Auditability Controls

- Rule version pinned to each calculation/validation result.
- Export batch captures source snapshot references for reproducibility.
- Lock operation marks period immutable; controlled revision creates a new governed event chain.

## 5) Build Stages Plan (A-D)

### Stage A: Foundation + Policy Baseline

- Set up repo structure for web, API, DB migrations.
- Implement auth and RBAC skeleton.
- Create configuration tables and admin CRUD endpoints.
- Establish audit framework (entity + field changes).
- Exit criteria:
  - Users can log in and access role-appropriate routes.
  - Config policy data is managed through API/UI.
  - Field-level auditing is active on all mutable entities.

### Stage B: Employee + Manager Workflow

- Build timesheet entry UI and timesheet row APIs.
- Implement deterministic calculation and validation engine.
- Implement submit/resubmit transitions.
- Build manager queue and detail review with approve/reject logic.
- Exit criteria:
  - End-to-end flow works from `Draft` to `Manager Approved/Rejected`.
  - Rejection reason captured and employee resubmission path verified.

### Stage C: Payroll Validation + Export + Locking

- Build payroll dashboard with exceptions queue.
- Implement controlled correction/revision flow.
- Implement CSV/XLSX export batch creation with batch IDs.
- Implement period locking and controlled unlock policy.
- Exit criteria:
  - `Manager Approved -> Payroll Validated -> Locked` is operational.
  - Exports are reproducible and auditable by batch metadata.

### Stage D: Hardening + Compliance + Go-Live

- Add integration tests for deterministic rule behavior and edge cases.
- Run performance tuning on critical paths.
- Finalize migration scripts, seed data, and operational runbooks.
- Perform UAT and defect closure.
- Exit criteria:
  - Compliance/audit checks pass.
  - MVP is stable and production-ready.
