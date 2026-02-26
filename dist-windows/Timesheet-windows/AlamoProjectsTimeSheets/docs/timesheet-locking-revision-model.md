# Timesheet Locking and Revision Model (Exact)

Product: **Timesheet**  
Subtitle: **for Alamo Projects**  
Footer standard on UI/PDF: **Innoweb Ventures Limited**

## 1) State Machine Table

Two state machines are enforced together:

1. `timesheet_header.workflow_status`
2. `timesheet_period.period_status`

### 1.1 Timesheet workflow state machine (revision-aware)

| Current status | Editable? | Who can edit | Allowed actions | Next status | Notes |
|---|---|---|---|---|---|
| `DRAFT` | Yes | Employee owner, Admin (override) | Save draft, Submit | `SUBMITTED` | Primary data-entry state |
| `SUBMITTED` | No | None (content locked) | Manager Approve, Manager Reject | `MANAGER_APPROVED` or `MANAGER_REJECTED` | Employee read-only |
| `MANAGER_REJECTED` | Yes | Employee owner, Admin | Edit, Resubmit | `SUBMITTED` | Rejection reason mandatory |
| `MANAGER_APPROVED` | No (direct edit) | None | Payroll Validate, Payroll Request Revision | `PAYROLL_VALIDATED` or `DRAFT` (new revision row) | Request Revision creates new `revision_no` |
| `PAYROLL_VALIDATED` | No (direct edit) | None | Lock (via period lock), Payroll/Admin Request Revision | `LOCKED` or `DRAFT` (new revision row) | Revision path only, not in-place |
| `LOCKED` | No | None | Unlock + Controlled Revision | original row remains `LOCKED`; new row is `DRAFT` | Immutable historical row |

### 1.2 Period lock state machine

| Current `period_status` | Editable timesheet content? | Allowed actions | Next `period_status` |
|---|---|---|---|
| `OPEN` | Yes (only `DRAFT` / `MANAGER_REJECTED`) | Payroll lock | `LOCKED` |
| `LOCKED` | No | Payroll/Admin unlock with reason | `IN_REVISION` |
| `IN_REVISION` | Yes (only newly created revision rows in `DRAFT`) | Re-validate + re-lock | `LOCKED` |

### 1.3 Exact rule for “edit after approval”

- Editing is **never in-place** for `MANAGER_APPROVED`, `PAYROLL_VALIDATED`, `LOCKED`.
- System action `REQUEST_REVISION` clones current row into a new revision:
  - `revision_no = previous.revision_no + 1`
  - `supersedes_header_id = previous.id`
  - `is_current = true` on new row; previous row set `is_current = false`
  - new row `workflow_status = DRAFT`
  - copy day entries and totals as starting point
  - attach mandatory revision reason + actor

## 2) DB Fields Needed

Existing fields already usable:

- `timesheet_header`: `workflow_status`, `revision_no`, `is_current`, `supersedes_header_id`, `row_version`, `submitted_at`, `manager_decided_at`, `payroll_validated_at`, `locked_at`, `rejection_reason`
- `timesheet_period`: `period_status`
- `approval_record`: `action`, `from_status`, `to_status`, `reason`, `metadata`
- `audit_event` + `audit_field_change`
- `payroll_export_batch`, `payroll_export_line`

### 2.1 Required additions

#### `timesheet_period`

```sql
ALTER TABLE timesheet_period
  ADD COLUMN revision_cycle_no INT NOT NULL DEFAULT 1,  -- increments on each unlock
  ADD COLUMN revision_opened_at TIMESTAMPTZ NULL,
  ADD COLUMN revision_closed_at TIMESTAMPTZ NULL;
```

#### `timesheet_header`

```sql
ALTER TABLE timesheet_header
  ADD COLUMN revision_origin TEXT NOT NULL DEFAULT 'INITIAL',   -- INITIAL|REJECTION|PAYROLL_RETURN|PERIOD_UNLOCK
  ADD COLUMN revision_reason_code TEXT NULL,                    -- POLICY_ERROR|DATA_CORRECTION|SYSTEM_ERROR|OTHER
  ADD COLUMN revision_reason_text TEXT NULL,
  ADD COLUMN period_revision_cycle_no INT NOT NULL DEFAULT 1;

ALTER TABLE timesheet_header
  ADD CONSTRAINT ck_revision_reason_required
  CHECK (
    revision_origin = 'INITIAL'
    OR (revision_reason_code IS NOT NULL AND revision_reason_text IS NOT NULL)
  );
```

#### New table: `period_unlock_event`

```sql
CREATE TABLE period_unlock_event (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_id BIGINT NOT NULL REFERENCES timesheet_period(id) ON DELETE RESTRICT,
  requested_by BIGINT NOT NULL REFERENCES employee(id) ON DELETE RESTRICT,
  approved_by BIGINT NULL REFERENCES employee(id) ON DELETE RESTRICT,
  reason_code TEXT NOT NULL,
  reason_text TEXT NOT NULL,
  ticket_ref TEXT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',         -- OPEN|CLOSED|CANCELLED
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ NULL
);
CREATE INDEX idx_period_unlock_event_period ON period_unlock_event(period_id, opened_at DESC);
```

#### `payroll_export_batch` and `payroll_export_line`

```sql
ALTER TABLE payroll_export_batch
  ADD COLUMN period_revision_cycle_no INT NOT NULL DEFAULT 1,
  ADD COLUMN input_signature_sha256 CHAR(64) NULL,
  ADD COLUMN export_contract_version TEXT NOT NULL DEFAULT 'timesheet-payroll-v1';

ALTER TABLE payroll_export_line
  ADD COLUMN timesheet_revision_no INT NOT NULL DEFAULT 1,
  ADD COLUMN period_revision_cycle_no INT NOT NULL DEFAULT 1;
```

### 2.2 Referential and audit expectations

- Each export line references exact `timesheet_header_id` (revision-specific row).
- `timesheet_revision_no` is denormalized for immutable reporting convenience.
- Every unlock/revision/relock writes:
  - `approval_record` action (`UNLOCK`, `RETURN_FOR_CORRECTION`, `LOCK`)
  - `audit_event` + `audit_field_change` entries with reason and actor.

## 3) API Endpoints for Unlock/Revise

### 3.1 Unlock period (controlled)

| Method | Path | Role | Request body | Result |
|---|---|---|---|---|
| `POST` | `/v1/payroll/periods/{periodId}/unlock` | `PAYROLL`, `ADMIN` | `{ "reason_code": "DATA_CORRECTION", "reason_text": "Fix incorrect PH coding after payroll audit.", "ticket_ref": "INC-4821" }` | Period `LOCKED -> IN_REVISION`, `revision_cycle_no += 1`, `period_unlock_event` created |

Rules:

- `reason_code` and `reason_text` mandatory.
- `reason_text` min length 15 chars.
- unauthorized roles => `403`.

### 3.2 Create revision from approved/validated/locked row

| Method | Path | Role | Request body | Result |
|---|---|---|---|---|
| `POST` | `/v1/timesheets/{timesheetId}/revisions` | `PAYROLL`, `ADMIN` (and `MANAGER` for manager-approved only if policy allows) | `{ "reason_code": "DATA_CORRECTION", "reason_text": "Incorrect leave code entered on PH date." }` | New `timesheet_header` row created with incremented `revision_no`, status `DRAFT`, old row archived (`is_current=false`) |

Rules:

- For `LOCKED` source row, period must be `IN_REVISION`.
- Endpoint is idempotent with `Idempotency-Key`.

### 3.3 Re-lock period after revision completion

| Method | Path | Role | Request body | Result |
|---|---|---|---|---|
| `POST` | `/v1/payroll/periods/{periodId}/relock` | `PAYROLL`, `ADMIN` | `{ "reason": "Revision cycle complete and re-validated." }` | `IN_REVISION -> LOCKED`, closes open unlock event, stamps `revision_closed_at` |

### 3.4 Revision history read

| Method | Path | Role | Result |
|---|---|---|---|
| `GET` | `/v1/timesheets/{timesheetId}/revisions` | owner/manager/payroll/admin scope | Ordered revision chain with reasons, statuses, timestamps |

## 4) UX Behaviors for “Edit After Approval”

### 4.1 Manager Approved / Payroll Validated states

- Main editor grid is read-only.
- Primary CTA is not “Edit”; it is:
  - `Request Revision` (role-gated)
- Clicking `Request Revision` opens modal:
  - required `Reason Code`
  - required `Reason`
  - optional ticket reference
- On confirm:
  - system creates new revision row (`DRAFT`)
  - user is redirected to new revision editor
  - banner shown: `Revision 3 created from locked revision 2`

### 4.2 Locked state behavior

- Show hard lock badge and immutable warning.
- Hide all edit controls.
- Show `Unlock Period` only for `PAYROLL`/`ADMIN`.
- Unlock modal requires reason and shows compliance warning:
  - “This action is fully audited.”

### 4.3 Revision chain UI

- Timesheet header displays:
  - `Current Revision: n`
  - `Supersedes Revision: n-1`
  - `Revision Origin` and reason
- Timeline panel shows transitions:
  - submit, approve/reject, payroll validate, lock, unlock, revision creation, relock
- Export metadata panel shows:
  - `Export Batch ID`
  - `Revision Used`
  - `Period Revision Cycle`

### 4.4 Editability matrix in UI

| Status | Day entries editable | Header notes editable | Submit visible | Approve/Reject visible | Lock visible |
|---|---|---|---|---|---|
| `DRAFT` | Yes | Yes | Yes | No | No |
| `SUBMITTED` | No | No | No | Manager only | No |
| `MANAGER_REJECTED` | Yes | Yes | Yes (Resubmit) | No | No |
| `MANAGER_APPROVED` | No | No | No | No | Payroll path only |
| `PAYROLL_VALIDATED` | No | No | No | No | Payroll only |
| `LOCKED` | No | No | No | No | Unlock only (Payroll/Admin) |

## 5) How Payroll Exports Reference a Locked Revision

1. Export is generated from current rows in a specific `period_revision_cycle_no`.
2. Each `payroll_export_line` stores:
  - `timesheet_header_id` (exact revision row)
  - `timesheet_revision_no`
  - `period_revision_cycle_no`
3. `payroll_export_batch` stores:
  - `period_id`
  - `period_revision_cycle_no`
  - `input_signature_sha256`
  - `checksum_sha256`
4. After unlock/revision/relock:
  - new cycle produces new export batch lineage
  - old export remains immutable and traceable to old locked revision rows.

