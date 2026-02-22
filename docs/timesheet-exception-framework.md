# Timesheet Exception Framework

Product: **Timesheet**  
Subtitle: **for Alamo Projects**  
Footer standard (all UI/PDF): **Innoweb Ventures Limited**

## 1) Exception Taxonomy

### 1.1 Severity levels

Use existing DB severity enum and blocking gate:

- `ERROR` (blocking by default)
- `WARNING` (non-blocking by default)

Optional UI priority (derived, not persisted):

- `P1` = blocking `ERROR`
- `P2` = non-blocking `ERROR` (policy override mode)
- `P3` = blocking `WARNING` (only if policy explicitly elevates)
- `P4` = non-blocking `WARNING`

### 1.2 Exception classes (deterministic)

| Code | Type | Default severity | Blocking | Source stage | Description |
|---|---|---|---|---|---|
| `MISSING_ENTRY_DAY` | Missing entry | `ERROR` | Yes | `ENTRY_VALIDATION` | Required period day has no worked row and no valid absence row. |
| `MISSING_APPROVAL` | Missing approval | `ERROR` | Yes | `PAYROLL_VALIDATION` | Required manager/payroll transition not complete. |
| `PH_CODE_REQUIRED` | PH mismatch | `ERROR` | Yes | `ENTRY_VALIDATION` | Public holiday not worked must be coded `PH`. |
| `PH_CODE_TIME_CONFLICT` | PH mismatch | `ERROR` | Yes | `ENTRY_VALIDATION` | `PH` code combined with worked time. |
| `OT_APPROVAL_REQUIRED` | Overtime without approval | `ERROR` | Yes | `MANAGER_VALIDATION` | OT minutes exist but manager confirmation missing. |
| `PH_WORKED_APPROVAL_REQUIRED` | PH worked without approval | `ERROR` | Yes | `MANAGER_VALIDATION` | PH worked minutes exist but manager confirmation missing. |
| `ABNORMAL_TOTALS` | Abnormal totals | `WARNING` | No (default) | `PAYROLL_VALIDATION` | Totals outside configured anomaly thresholds. |
| `RULE_CONFLICT_EFFECTIVE_DATES` | Rule conflict | `ERROR` | Yes | `CONFIG_VALIDATION` | Overlapping effective-dated rules for same key. |
| `RULE_CONFLICT_DAYTYPE` | Rule conflict | `ERROR` | Yes | `CONFIG_VALIDATION` | Contradictory day-type precedence or duplicate active match. |
| `CODE_TIME_CONFLICT` | Invalid combo | `ERROR` | Yes | `ENTRY_VALIDATION` | Absence/leave code and start/finish both set. |
| `IMPOSSIBLE_HOURS` | Invalid totals | `ERROR` | Yes | `ENTRY_VALIDATION` | Worked/paid total exceeds configured max/day. |

### 1.3 Override policy matrix

| Exception code | Override allowed? | Allowed roles | Requirements |
|---|---|---|---|
| `ABNORMAL_TOTALS` | Yes | `PAYROLL`, `ADMIN` | Reason code + reason text required |
| `MISSING_ENTRY_DAY` | Conditional | `ADMIN` only | Reason + ticket reference + second approver (optional policy) |
| `MISSING_APPROVAL` | No | None | Must resolve workflow state correctly |
| `OT_APPROVAL_REQUIRED` | No | None | Manager must confirm |
| `PH_WORKED_APPROVAL_REQUIRED` | No | None | Manager must confirm |
| `PH_CODE_REQUIRED` | No | None | Employee correction required |
| `RULE_CONFLICT_*` | No | None | Config must be corrected/published |
| `CODE_TIME_CONFLICT` | No | None | Data correction required |
| `IMPOSSIBLE_HOURS` | No | None | Data correction required |

## 2) Detection Rules

### 2.1 Deterministic detection sequence

1. Run structural entry checks:
  - missing time pair, finish-before-start, code/time conflict.
2. Run calendar checks:
  - PH-not-worked must be `PH`, PH code cannot coexist with time.
3. Run calculation checks:
  - impossible/negative totals, daily caps, weekly caps.
4. Run approval checks:
  - OT/PH worked approvals present when required.
5. Run payroll checks:
  - missing workflow approvals, abnormal totals, export readiness.
6. Run config checks (admin publish/validation):
  - effective-date overlaps, contradictory rule precedence.

### 2.2 Detection query examples (conceptual)

#### Missing entry day

```sql
-- For required dates in period where no valid day row exists
-- emit MISSING_ENTRY_DAY
```

#### Missing approval

```sql
-- If timesheet.workflow_status not in ('PAYROLL_VALIDATED','LOCKED')
-- at export validation stage, emit MISSING_APPROVAL
```

#### Overtime without manager approval

```sql
-- If total_ot_minutes > 0 and manager_ot_confirmed = false
-- emit OT_APPROVAL_REQUIRED
```

#### Abnormal totals

```sql
-- If weekly paid hours > configured threshold (e.g., 80)
-- emit ABNORMAL_TOTALS as warning by default
```

### 2.3 De-duplication and lifecycle

- Unique live exception key:
  - `(timesheet_header_id, rule_code, field_path, source_stage, is_resolved=false)`
- On re-validation:
  - resolved exceptions are preserved (immutable history)
  - same unresolved signature should update timestamp/counters, not duplicate rows

## 3) Override and Logging Model

### 3.1 Required DB additions

Extend `timesheet_exception`:

```sql
ALTER TABLE timesheet_exception
  ADD COLUMN override_status TEXT NOT NULL DEFAULT 'NONE', -- NONE|OVERRIDDEN|REJECTED
  ADD COLUMN override_by BIGINT NULL REFERENCES employee(id) ON DELETE SET NULL,
  ADD COLUMN override_at TIMESTAMPTZ NULL,
  ADD COLUMN override_reason_code TEXT NULL,
  ADD COLUMN override_reason_text TEXT NULL,
  ADD COLUMN resolution_note TEXT NULL;
```

New table `exception_override_event` (immutable):

```sql
CREATE TABLE exception_override_event (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  timesheet_exception_id BIGINT NOT NULL REFERENCES timesheet_exception(id) ON DELETE RESTRICT,
  action TEXT NOT NULL, -- REQUEST_OVERRIDE|APPROVE_OVERRIDE|REJECT_OVERRIDE|REOPEN
  actor_employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE RESTRICT,
  reason_code TEXT NULL,
  reason_text TEXT NULL,
  ticket_ref TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.2 Override governance rules

1. Override allowed only if exception code is marked overridable by policy.
2. Override requires:
  - `override_reason_code`
  - `override_reason_text` (min length, e.g., 15)
3. Override action must:
  - set `override_status='OVERRIDDEN'`
  - set `is_resolved=true`
  - write `exception_override_event`
  - write `audit_event` + `audit_field_change`
4. Reopen action allowed by `ADMIN`/`PAYROLL` to reverse incorrect overrides.

## 4) Payroll Dashboard Filters and Queues

### 4.1 Queue model

- Queue 1: `Blocking Exceptions` (default landing queue)
- Queue 2: `Overridable Exceptions Pending Decision`
- Queue 3: `Warnings`
- Queue 4: `Resolved/Overridden`

### 4.2 Filter set

Mandatory filters:

- `period_id`
- `severity` (`ERROR`, `WARNING`)
- `blocking` (`true/false`)
- `rule_code`
- `source_stage`
- `override_status`
- `is_resolved`
- `employee_number`
- `team/manager`
- `updated_from` / `updated_to`

Quick filters:

- `Export Blockers`
- `Overtime Approval Missing`
- `PH Mismatch`
- `Rule Conflicts`
- `Overridden Today`

### 4.3 UI list behavior

For each row display:

- exception code + short message
- employee + period
- stage + severity chip
- blocking chip
- override status chip
- field path deep-link
- created/updated timestamps

Behavior:

1. Clicking row opens right-side detail panel.
2. Detail panel shows:
  - data snapshot
  - related workflow status
  - prior override events
  - audit references
3. Action buttons are role and policy driven:
  - `Resolve` (if user can fix source)
  - `Request Override`
  - `Approve Override`
  - `Reject Override`
  - `Reopen`
4. Bulk actions:
  - only for homogeneous non-blocking warnings by policy.

## 5) API Contract for Exceptions

### 5.1 List exceptions (existing + extended filters)

| Method | Path | Roles | Query params | Response |
|---|---|---|---|---|
| `GET` | `/v1/payroll/periods/{period_id}/exceptions` | `PAYROLL`, `ADMIN` | `is_resolved`, `severity`, `rule_code`, `blocking`, `source_stage`, `override_status`, `employee_number`, `page`, `page_size` | Paged list of exception rows |

Response item shape:

```json
{
  "id": 700,
  "timesheet_id": 5001,
  "employee_number": "E1001",
  "severity": "ERROR",
  "is_blocking": true,
  "rule_code": "PH_CODE_REQUIRED",
  "field_path": "entries[2026-02-19].absence_code",
  "message": "Public holiday not worked must be PH.",
  "source_stage": "ENTRY_VALIDATION",
  "is_resolved": false,
  "override_status": "NONE",
  "created_at": "2026-02-22T10:10:00Z"
}
```

### 5.2 Re-run exception detection for timesheet

| Method | Path | Roles | Request body | Response |
|---|---|---|---|---|
| `POST` | `/v1/payroll/timesheets/{timesheet_id}/exceptions/recompute` | `PAYROLL`, `ADMIN` | `{ "source_stage": "PAYROLL_VALIDATION" }` | `{ "generated": 3, "resolved": 2, "open": 4 }` |

Idempotency:
- same input on unchanged data returns same open exception set.

### 5.3 Resolve exception (non-override)

| Method | Path | Roles | Request body | Response |
|---|---|---|---|---|
| `POST` | `/v1/payroll/exceptions/{exception_id}/resolve` | `PAYROLL`, `ADMIN` | `{ "resolution_note": "Corrected absence code to PH." }` | updated exception |

Rules:
- allowed only when source data is corrected and rule no longer violated.

### 5.4 Request override

| Method | Path | Roles | Request body | Response |
|---|---|---|---|---|
| `POST` | `/v1/payroll/exceptions/{exception_id}/override/request` | `PAYROLL`, `ADMIN` | `{ "reason_code": "BUSINESS_EXCEPTION", "reason_text": "Approved by payroll lead due to emergency run.", "ticket_ref": "PAY-2231" }` | override request event |

### 5.5 Approve override

| Method | Path | Roles | Request body | Response |
|---|---|---|---|---|
| `POST` | `/v1/payroll/exceptions/{exception_id}/override/approve` | `PAYROLL`, `ADMIN` | `{ "reason_code": "BUSINESS_EXCEPTION", "reason_text": "Reviewed and approved." }` | exception marked resolved/overridden |

### 5.6 Reject override

| Method | Path | Roles | Request body | Response |
|---|---|---|---|---|
| `POST` | `/v1/payroll/exceptions/{exception_id}/override/reject` | `PAYROLL`, `ADMIN` | `{ "reason_text": "Insufficient evidence." }` | override status `REJECTED` |

### 5.7 Reopen exception

| Method | Path | Roles | Request body | Response |
|---|---|---|---|---|
| `POST` | `/v1/payroll/exceptions/{exception_id}/reopen` | `ADMIN` (or policy) | `{ "reason_text": "Override invalid after audit review." }` | exception reopened |

### 5.8 Exception summary KPI endpoint

| Method | Path | Roles | Query params | Response |
|---|---|---|---|---|
| `GET` | `/v1/payroll/periods/{period_id}/exceptions/summary` | `PAYROLL`, `ADMIN` | optional team filters | counts by severity, blocking, rule_code, override_status |

## 6) Error and Idempotency Rules

- Mutations require auth + RBAC.
- `Idempotency-Key` required for override/resolve mutation endpoints.
- Common errors:
  - `403 FORBIDDEN` (role not allowed)
  - `404 EXCEPTION_NOT_FOUND`
  - `409 EXCEPTION_STATE_CONFLICT`
  - `422 OVERRIDE_NOT_ALLOWED` / `REASON_REQUIRED`

## 7) Audit Requirements

Every exception mutation writes:

1. `audit_event`:
  - entity: `timesheet_exception`
  - operation: `UPDATE` / `OVERRIDE`
  - actor, request_id, reason
2. `audit_field_change`:
  - `is_resolved`, `override_status`, `override_by`, `override_reason_code`, `override_reason_text`
3. `exception_override_event` row (for override lifecycle)

