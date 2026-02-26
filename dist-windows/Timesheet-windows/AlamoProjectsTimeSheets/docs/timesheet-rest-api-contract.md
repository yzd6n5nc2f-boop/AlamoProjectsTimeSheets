# Timesheet REST API Contract (MVP)

Product: **Timesheet**  
Subtitle: **for Alamo Projects**  
Workflow: `DRAFT -> SUBMITTED -> MANAGER_APPROVED / MANAGER_REJECTED -> PAYROLL_VALIDATED -> LOCKED`

## 0) Conventions

### Base and transport

- Base URL: `/v1`
- Auth: Bearer access token (`Authorization: Bearer <token>`)
- Token refresh: refresh token cookie (`HttpOnly`, `Secure`, `SameSite=Strict`)
- Content type: `application/json` unless download endpoint
- Time format: ISO-8601 UTC (`2026-02-22T15:00:00Z`)

### Roles

- `EMPLOYEE`
- `MANAGER`
- `PAYROLL`
- `ADMIN`

### Common headers

- `X-Request-Id` (optional; echoed back)
- `Idempotency-Key` (required for non-idempotent mutations where noted)
- `If-Match` (optional optimistic concurrency token from ETag or `row_version`)

### Standard success envelope

```json
{
  "data": {},
  "meta": {
    "request_id": "uuid",
    "timestamp": "2026-02-22T15:00:00Z"
  }
}
```

### Standard error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Finish must be later than Start.",
    "details": [
      {"field": "finish_time", "reason": "MUST_BE_AFTER_START"}
    ]
  },
  "meta": {
    "request_id": "uuid",
    "timestamp": "2026-02-22T15:00:00Z"
  }
}
```

### Common error codes

- `400 BAD_REQUEST`
- `401 UNAUTHENTICATED`
- `403 FORBIDDEN`
- `404 NOT_FOUND`
- `409 CONFLICT` (workflow/status conflict, optimistic lock)
- `422 VALIDATION_ERROR`
- `429 RATE_LIMITED`
- `500 INTERNAL_ERROR`

---

## 1) Auth Endpoints

### 1.1 Login

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/auth/login` |
| Auth role | Public |
| Request body | `{ "email": "user@company.com", "password": "string", "remember_device": true }` |
| Response body | `{ "data": { "access_token": "jwt", "expires_in": 900, "user": { "id": 10, "employee_number": "E1001", "roles": ["EMPLOYEE"] }}}` plus refresh cookie |
| Errors | `400`, `401 INVALID_CREDENTIALS`, `423 ACCOUNT_LOCKED`, `429` |
| Idempotency notes | Not idempotent. Retries may create new tokens/sessions. |

### 1.2 Refresh token

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/auth/refresh` |
| Auth role | Public (requires valid refresh cookie) |
| Request body | `{}` |
| Response body | `{ "data": { "access_token": "jwt", "expires_in": 900 }}` |
| Errors | `401 REFRESH_INVALID_OR_EXPIRED`, `429` |
| Idempotency notes | Effectively idempotent for retries within refresh window. |

### 1.3 Logout

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/auth/logout` |
| Auth role | Any authenticated user |
| Request body | `{ "all_devices": false }` |
| Response body | `{ "data": { "logged_out": true }}` (refresh cookie cleared) |
| Errors | `401`, `500` |
| Idempotency notes | Idempotent. Repeated logout returns success. |

### 1.4 Forgot password

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/auth/forgot-password` |
| Auth role | Public |
| Request body | `{ "email": "user@company.com" }` |
| Response body | `{ "data": { "accepted": true }}` (no account existence leak) |
| Errors | `400`, `429`, `500` |
| Idempotency notes | Idempotent from client perspective; always returns accepted. |

### 1.5 Reset password

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/auth/reset-password` |
| Auth role | Public |
| Request body | `{ "token": "reset-token", "new_password": "string" }` |
| Response body | `{ "data": { "password_reset": true }}` |
| Errors | `400`, `401 RESET_TOKEN_INVALID`, `410 RESET_TOKEN_USED_OR_EXPIRED`, `422 PASSWORD_POLICY_FAILED` |
| Idempotency notes | Single-use token by design; second call with same token returns `410`. |

---

## 2) Employees (Admin)

### 2.1 List employees

| Field | Value |
|---|---|
| Method | `GET` |
| Path | `/v1/admin/employees` |
| Auth role | `ADMIN` |
| Request body | None. Query: `q`, `active`, `manager_id`, `page`, `page_size` |
| Response body | `{ "data": [ { "id": 10, "employee_number": "E1001", "first_name": "Ana", "last_name": "Lee", "email": "ana@co.com", "manager_employee_id": 22, "active": true } ], "meta": { "page": 1, "page_size": 50, "total": 123 }}` |
| Errors | `401`, `403`, `400` |
| Idempotency notes | Read-only; idempotent. |

### 2.2 Create employee

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/admin/employees` |
| Auth role | `ADMIN` |
| Request body | `{ "employee_number": "E1001", "first_name": "Ana", "last_name": "Lee", "email": "ana@co.com", "manager_employee_id": 22, "timezone": "Australia/Sydney", "hired_on": "2026-01-05" }` |
| Response body | `{ "data": { "id": 10, "employee_number": "E1001", "...": "..." }}` |
| Errors | `401`, `403`, `409 EMPLOYEE_NUMBER_EXISTS`, `422` |
| Idempotency notes | Use `Idempotency-Key`. Same key + same payload returns original `201`. |

### 2.3 Get employee

| Field | Value |
|---|---|
| Method | `GET` |
| Path | `/v1/admin/employees/{employee_id}` |
| Auth role | `ADMIN` |
| Request body | None |
| Response body | `{ "data": { "id": 10, "employee_number": "E1001", "...": "..." }}` |
| Errors | `401`, `403`, `404` |
| Idempotency notes | Read-only; idempotent. |

### 2.4 Update employee

| Field | Value |
|---|---|
| Method | `PATCH` |
| Path | `/v1/admin/employees/{employee_id}` |
| Auth role | `ADMIN` |
| Request body | Partial fields: `{ "manager_employee_id": 25, "active": true, "terminated_on": null, "row_version": 4 }` |
| Response body | `{ "data": { "id": 10, "row_version": 5, "...": "..." }}` |
| Errors | `401`, `403`, `404`, `409 ROW_VERSION_CONFLICT`, `422` |
| Idempotency notes | Idempotent if same patch + same resource version. Prefer optimistic lock with `row_version`. |

---

## 3) Timesheet Periods (Admin)

### 3.1 List periods

| Field | Value |
|---|---|
| Method | `GET` |
| Path | `/v1/admin/periods` |
| Auth role | `ADMIN` |
| Request body | None. Query: `status`, `from`, `to`, `page`, `page_size` |
| Response body | `{ "data": [ { "id": 100, "period_start": "2026-02-16", "period_end": "2026-02-22", "period_status": "OPEN", "rule_set_id": 3 } ] }` |
| Errors | `401`, `403`, `400` |
| Idempotency notes | Read-only; idempotent. |

### 3.2 Create period

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/admin/periods` |
| Auth role | `ADMIN` |
| Request body | `{ "period_name": "2026-W08", "period_start": "2026-02-16", "period_end": "2026-02-22", "submission_open_at": "2026-02-16T00:00:00Z", "submission_close_at": "2026-02-24T23:59:59Z", "rule_set_id": 3 }` |
| Response body | `{ "data": { "id": 100, "...": "..." }}` |
| Errors | `401`, `403`, `409 PERIOD_OVERLAP`, `422` |
| Idempotency notes | Use `Idempotency-Key` to protect create retries. |

### 3.3 Get period

| Field | Value |
|---|---|
| Method | `GET` |
| Path | `/v1/admin/periods/{period_id}` |
| Auth role | `ADMIN` |
| Request body | None |
| Response body | `{ "data": { "id": 100, "...": "..." }}` |
| Errors | `401`, `403`, `404` |
| Idempotency notes | Read-only; idempotent. |

### 3.4 Update period

| Field | Value |
|---|---|
| Method | `PATCH` |
| Path | `/v1/admin/periods/{period_id}` |
| Auth role | `ADMIN` |
| Request body | Partial fields + `row_version` equivalent if exposed |
| Response body | Updated period |
| Errors | `401`, `403`, `404`, `409 PERIOD_LOCKED_OR_VERSION_CONFLICT`, `422` |
| Idempotency notes | Idempotent patch semantics; status guards prevent invalid updates. |

---

## 4) Calendar Rules (Admin)

### 4.1 List rule sets

| Field | Value |
|---|---|
| Method | `GET` |
| Path | `/v1/admin/calendar-rulesets` |
| Auth role | `ADMIN` |
| Request body | None. Query: `published`, `effective_on`, `page` |
| Response body | `{ "data": [ { "id": 3, "rule_name": "AU_STD", "version_no": 7, "is_published": true, "effective_from": "2026-01-01" } ] }` |
| Errors | `401`, `403` |
| Idempotency notes | Read-only; idempotent. |

### 4.2 Create draft rule set

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/admin/calendar-rulesets` |
| Auth role | `ADMIN` |
| Request body | `{ "rule_name": "AU_STD", "version_no": 8, "effective_from": "2026-03-01", "timezone": "Australia/Sydney" }` |
| Response body | Rule set draft |
| Errors | `401`, `403`, `409 RULESET_VERSION_EXISTS`, `422` |
| Idempotency notes | `Idempotency-Key` recommended. |

### 4.3 Upsert public holidays

| Field | Value |
|---|---|
| Method | `PUT` |
| Path | `/v1/admin/calendar-rulesets/{ruleset_id}/public-holidays` |
| Auth role | `ADMIN` |
| Request body | `{ "holidays": [ { "holiday_date": "2026-04-25", "holiday_name": "ANZAC Day", "region_code": "NSW", "is_paid": true } ] }` |
| Response body | `{ "data": { "count": 24 }}` |
| Errors | `401`, `403`, `404`, `409 RULESET_PUBLISHED`, `422` |
| Idempotency notes | Full-replace PUT is idempotent by definition. |

### 4.4 Upsert special day rules (early knock-off, Friday short day)

| Field | Value |
|---|---|
| Method | `PUT` |
| Path | `/v1/admin/calendar-rulesets/{ruleset_id}/special-day-rules` |
| Auth role | `ADMIN` |
| Request body | `{ "rules": [ { "rule_kind": "EARLY_KNOCK_OFF", "day_type_code": "EKO", "start_date": "2026-12-24", "paid_minutes": 480, "priority": 10 }, { "rule_kind": "FRIDAY_SHORT_DAY", "day_type_code": "FRI_SHORT", "weekday": 5, "normal_minutes_cap": 360, "priority": 20 } ] }` |
| Response body | `{ "data": { "count": 2 }}` |
| Errors | `401`, `403`, `404`, `409 RULESET_PUBLISHED`, `422` |
| Idempotency notes | Full-replace PUT is idempotent. |

### 4.5 Upsert paid-hours policies

| Field | Value |
|---|---|
| Method | `PUT` |
| Path | `/v1/admin/calendar-rulesets/{ruleset_id}/paid-hours-policies` |
| Auth role | `ADMIN` |
| Request body | `{ "policies": [ { "policy_code": "STD8", "daily_normal_minutes": 480, "weekly_normal_minutes": 2280, "friday_normal_minutes": 360, "rounding_increment_minutes": 15, "is_default": true } ] }` |
| Response body | `{ "data": { "count": 1 }}` |
| Errors | `401`, `403`, `404`, `409 RULESET_PUBLISHED`, `422` |
| Idempotency notes | Full-replace PUT is idempotent. |

### 4.6 Publish rule set

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/admin/calendar-rulesets/{ruleset_id}/publish` |
| Auth role | `ADMIN` |
| Request body | `{ "published_at": "2026-02-22T15:00:00Z" }` |
| Response body | `{ "data": { "id": 3, "is_published": true, "published_at": "..." }}` |
| Errors | `401`, `403`, `404`, `409 ALREADY_PUBLISHED`, `422 INCOMPLETE_RULESET` |
| Idempotency notes | Idempotent if already published with same version; return current state. |

---

## 5) Timesheets (Employee)

### 5.1 Create or get current timesheet header

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/timesheets` |
| Auth role | `EMPLOYEE` (self), `ADMIN` (on behalf) |
| Request body | `{ "period_id": 100, "employee_id": 10 }` (`employee_id` optional for self) |
| Response body | `{ "data": { "id": 5001, "employee_id": 10, "period_id": 100, "workflow_status": "DRAFT", "revision_no": 1, "row_version": 1 }}` |
| Errors | `401`, `403`, `404 PERIOD_NOT_FOUND`, `409 PERIOD_LOCKED` |
| Idempotency notes | Upsert semantics by `(employee_id, period_id, is_current=true)`; safe to retry. |

### 5.2 List my timesheets

| Field | Value |
|---|---|
| Method | `GET` |
| Path | `/v1/timesheets` |
| Auth role | `EMPLOYEE`, `MANAGER`, `PAYROLL`, `ADMIN` (scope-based) |
| Request body | None. Query: `employee_id`, `period_id`, `status`, `page` |
| Response body | List of headers with totals and status chips |
| Errors | `401`, `403`, `400` |
| Idempotency notes | Read-only; idempotent. |

### 5.3 Get timesheet detail

| Field | Value |
|---|---|
| Method | `GET` |
| Path | `/v1/timesheets/{timesheet_id}` |
| Auth role | `EMPLOYEE` owner, assigned `MANAGER`, `PAYROLL`, `ADMIN` |
| Request body | None |
| Response body | Header + day entries + weekly totals + period totals + validation summary |
| Errors | `401`, `403`, `404` |
| Idempotency notes | Read-only; idempotent. |

### 5.4 Save draft header-level fields

| Field | Value |
|---|---|
| Method | `PATCH` |
| Path | `/v1/timesheets/{timesheet_id}` |
| Auth role | `EMPLOYEE` owner, `ADMIN` in revision |
| Request body | `{ "row_version": 4, "notes": "optional header notes" }` |
| Response body | Updated header and recalculated totals snapshot |
| Errors | `401`, `403`, `404`, `409 ROW_VERSION_CONFLICT`, `409 STATUS_NOT_EDITABLE`, `422` |
| Idempotency notes | Idempotent with same patch + version. |

### 5.5 Submit timesheet

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/timesheets/{timesheet_id}/submit` |
| Auth role | `EMPLOYEE` owner |
| Request body | `{ "row_version": 8, "declaration_accepted": true }` |
| Response body | `{ "data": { "id": 5001, "workflow_status": "SUBMITTED", "submitted_at": "..." }}` |
| Errors | `401`, `403`, `404`, `409 INVALID_WORKFLOW_TRANSITION`, `409 ROW_VERSION_CONFLICT`, `422 BLOCKING_VALIDATIONS_PRESENT` |
| Idempotency notes | Require `Idempotency-Key`. Repeated same key returns same submit result. |

---

## 6) Day Entries (Upsert rows)

### 6.1 Bulk upsert day entries

| Field | Value |
|---|---|
| Method | `PUT` |
| Path | `/v1/timesheets/{timesheet_id}/day-entries` |
| Auth role | `EMPLOYEE` owner, `ADMIN` in controlled revision |
| Request body | `{ "row_version": 8, "entries": [ { "work_date": "2026-02-16", "line_no": 1, "start_local": "08:00", "end_local": "16:30", "break_minutes": 30, "absence_code": null, "notes": "Site A" }, { "work_date": "2026-02-17", "line_no": 1, "start_local": null, "end_local": null, "break_minutes": 0, "absence_code": "PH", "notes": null } ] }` |
| Response body | `{ "data": { "timesheet_id": 5001, "row_version": 9, "entries": [ ...computed minutes... ], "weekly_totals": [...], "period_totals": {...}, "validation": { "blocking_errors": [], "warnings": [] }}}` |
| Errors | `401`, `403`, `404`, `409 STATUS_NOT_EDITABLE`, `409 ROW_VERSION_CONFLICT`, `422` (invalid combos/time logic) |
| Idempotency notes | PUT is idempotent for same payload snapshot; include `row_version` for concurrency. |

### 6.2 Delete a day entry line (optional)

| Field | Value |
|---|---|
| Method | `DELETE` |
| Path | `/v1/timesheets/{timesheet_id}/day-entries/{entry_id}` |
| Auth role | `EMPLOYEE` owner, `ADMIN` in controlled revision |
| Request body | None (or `row_version` query/header) |
| Response body | `{ "data": { "deleted": true, "row_version": 10 }}` |
| Errors | `401`, `403`, `404`, `409 STATUS_NOT_EDITABLE`, `409 ROW_VERSION_CONFLICT` |
| Idempotency notes | Idempotent delete semantics; repeated call returns success or `404` by API preference. |

---

## 7) Manager Approvals

### 7.1 Manager queue

| Field | Value |
|---|---|
| Method | `GET` |
| Path | `/v1/manager/timesheets/queue` |
| Auth role | `MANAGER` |
| Request body | None. Query: `team_id`, `has_ot`, `has_ph`, `submitted_from`, `submitted_to`, `page`, `sort` |
| Response body | `{ "data": [ { "timesheet_id": 5001, "employee_id": 10, "employee_name": "Ana Lee", "period_id": 100, "workflow_status": "SUBMITTED", "total_ot_minutes": 120, "total_ph_worked_minutes": 0, "submitted_at": "..." } ], "meta": { "total": 24 }}` |
| Errors | `401`, `403` |
| Idempotency notes | Read-only; idempotent. |

### 7.2 Manager approve

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/manager/timesheets/{timesheet_id}/approve` |
| Auth role | `MANAGER` |
| Request body | `{ "row_version": 8, "notes": "Looks good", "ot_confirmed": true, "ph_confirmed": true }` |
| Response body | `{ "data": { "timesheet_id": 5001, "workflow_status": "MANAGER_APPROVED", "manager_decided_at": "..." }}` |
| Errors | `401`, `403`, `404`, `409 INVALID_WORKFLOW_TRANSITION`, `409 ROW_VERSION_CONFLICT`, `422 OT_OR_PH_CONFIRMATION_REQUIRED` |
| Idempotency notes | Require `Idempotency-Key` to avoid duplicate approval side effects. |

### 7.3 Manager reject

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/manager/timesheets/{timesheet_id}/reject` |
| Auth role | `MANAGER` |
| Request body | `{ "row_version": 8, "reason": "Missing Friday notes", "notes": "Please correct Friday entry." }` |
| Response body | `{ "data": { "timesheet_id": 5001, "workflow_status": "MANAGER_REJECTED", "manager_decided_at": "..." }}` |
| Errors | `401`, `403`, `404`, `409 INVALID_WORKFLOW_TRANSITION`, `409 ROW_VERSION_CONFLICT`, `422 REASON_REQUIRED` |
| Idempotency notes | Require `Idempotency-Key`; same key returns same rejection result. |

---

## 8) Payroll Validation + Export + Lock

### 8.1 List payroll exceptions for period

| Field | Value |
|---|---|
| Method | `GET` |
| Path | `/v1/payroll/periods/{period_id}/exceptions` |
| Auth role | `PAYROLL`, `ADMIN` |
| Request body | None. Query: `is_resolved`, `severity`, `rule_code`, `page` |
| Response body | `{ "data": [ { "id": 700, "timesheet_id": 5001, "severity": "ERROR", "rule_code": "PH_CODE_REQUIRED", "field_path": "entries[2026-01-26].absence_code", "message": "Public holiday not worked must be PH", "is_blocking": true } ] }` |
| Errors | `401`, `403`, `404` |
| Idempotency notes | Read-only; idempotent. |

### 8.2 Validate one timesheet for payroll

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/payroll/timesheets/{timesheet_id}/validate` |
| Auth role | `PAYROLL` |
| Request body | `{ "recompute": true }` |
| Response body | `{ "data": { "timesheet_id": 5001, "valid": false, "blocking_error_count": 2, "warning_count": 1, "exceptions": [ ... ] }}` |
| Errors | `401`, `403`, `404`, `409 STATUS_NOT_MANAGER_APPROVED` |
| Idempotency notes | Idempotent by content; recomputation yields same result for unchanged data/rules. |

### 8.3 Mark timesheet payroll validated

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/payroll/timesheets/{timesheet_id}/mark-validated` |
| Auth role | `PAYROLL` |
| Request body | `{ "row_version": 9 }` |
| Response body | `{ "data": { "timesheet_id": 5001, "workflow_status": "PAYROLL_VALIDATED", "payroll_validated_at": "..." }}` |
| Errors | `401`, `403`, `404`, `409 BLOCKING_EXCEPTIONS_PRESENT`, `409 INVALID_WORKFLOW_TRANSITION`, `409 ROW_VERSION_CONFLICT` |
| Idempotency notes | `Idempotency-Key` required. Same key returns same transition response. |

### 8.4 Create payroll export batch

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/payroll/export-batches` |
| Auth role | `PAYROLL`, `ADMIN` |
| Request body | `{ "period_id": 100, "export_format": "BOTH", "include_timesheet_ids": [5001, 5002] }` |
| Response body | `{ "data": { "id": 900, "batch_id": "BATCH-2026-02-22-001", "period_id": 100, "status": "GENERATED", "line_count": 240, "generated_at": "...", "csv_uri": "/v1/payroll/export-batches/BATCH-2026-02-22-001/download?format=CSV", "xlsx_uri": "/v1/payroll/export-batches/BATCH-2026-02-22-001/download?format=XLSX" }}` |
| Errors | `401`, `403`, `404`, `409 PERIOD_NOT_EXPORT_READY`, `422` |
| Idempotency notes | `Idempotency-Key` required to avoid duplicate batches on retries. |

### 8.5 Lock period

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/v1/payroll/periods/{period_id}/lock` |
| Auth role | `PAYROLL` (`ADMIN` optional by policy) |
| Request body | `{ "reason": "Payroll run completed" }` |
| Response body | `{ "data": { "period_id": 100, "period_status": "LOCKED", "locked_at": "..." }}` |
| Errors | `401`, `403`, `404`, `409 PERIOD_NOT_LOCKABLE`, `409 ALREADY_LOCKED` |
| Idempotency notes | Idempotent: if already locked, return current locked state. |

---

## 9) Export Read and Download

### 9.1 Get batch metadata

| Field | Value |
|---|---|
| Method | `GET` |
| Path | `/v1/payroll/export-batches/{batch_id}` |
| Auth role | `PAYROLL`, `ADMIN` |
| Request body | None |
| Response body | `{ "data": { "batch_id": "BATCH-2026-02-22-001", "period_id": 100, "status": "GENERATED", "line_count": 240, "checksum_sha256": "hex", "generated_at": "...", "files": [ {"format": "CSV", "size_bytes": 12345}, {"format": "XLSX", "size_bytes": 778899} ] }}` |
| Errors | `401`, `403`, `404` |
| Idempotency notes | Read-only; idempotent. |

### 9.2 Download CSV/XLSX

| Field | Value |
|---|---|
| Method | `GET` |
| Path | `/v1/payroll/export-batches/{batch_id}/download` |
| Auth role | `PAYROLL`, `ADMIN` |
| Request body | None. Query: `format=CSV|XLSX` |
| Response body | File stream (`text/csv` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) |
| Errors | `401`, `403`, `404`, `409 FILE_NOT_READY` |
| Idempotency notes | Read-only; idempotent. |

---

## 10) Audit Log Read Endpoints (Admin)

### 10.1 List audit events

| Field | Value |
|---|---|
| Method | `GET` |
| Path | `/v1/admin/audit/events` |
| Auth role | `ADMIN` |
| Request body | None. Query: `entity_table`, `entity_pk`, `actor_employee_id`, `operation`, `from`, `to`, `request_id`, `page`, `page_size` |
| Response body | `{ "data": [ { "id": 12000, "entity_table": "timesheet_header", "entity_pk": "5001", "operation": "TRANSITION", "actor_employee_id": 22, "reason": "Approved", "occurred_at": "..." } ], "meta": { "total": 5421 }}` |
| Errors | `401`, `403`, `400` |
| Idempotency notes | Read-only; idempotent. |

### 10.2 Get audit event detail

| Field | Value |
|---|---|
| Method | `GET` |
| Path | `/v1/admin/audit/events/{audit_event_id}` |
| Auth role | `ADMIN` |
| Request body | None |
| Response body | `{ "data": { "event": { ... }, "field_changes": [ { "field_path": "workflow_status", "old_value": "SUBMITTED", "new_value": "MANAGER_APPROVED" } ] }}` |
| Errors | `401`, `403`, `404` |
| Idempotency notes | Read-only; idempotent. |

### 10.3 Get audit trail by entity

| Field | Value |
|---|---|
| Method | `GET` |
| Path | `/v1/admin/audit/entities/{entity_table}/{entity_pk}` |
| Auth role | `ADMIN` |
| Request body | None. Query: `from`, `to`, `page` |
| Response body | Ordered event trail for single business entity |
| Errors | `401`, `403`, `404` |
| Idempotency notes | Read-only; idempotent. |

---

## 11) Deterministic status transition guard (applies to endpoints)

- Allowed only:
  - `DRAFT -> SUBMITTED`
  - `SUBMITTED -> MANAGER_APPROVED`
  - `SUBMITTED -> MANAGER_REJECTED`
  - `MANAGER_APPROVED -> PAYROLL_VALIDATED`
  - `PAYROLL_VALIDATED -> LOCKED`
- Rejection rework path:
  - `MANAGER_REJECTED -> SUBMITTED` (via employee resubmit after edits)
- Any other transition returns `409 INVALID_WORKFLOW_TRANSITION`.

## 12) Idempotency and concurrency policy summary

- Require `Idempotency-Key` on:
  - `POST /auth/login` (recommended)
  - all workflow transition POSTs (`submit`, `approve`, `reject`, `mark-validated`, `lock`)
  - create batch and create resources
- Use optimistic concurrency:
  - `row_version` in mutation request body or `If-Match`
  - mismatch returns `409 ROW_VERSION_CONFLICT`
- For retries with same `Idempotency-Key` and identical payload:
  - return same status code and same response body.
