# Timesheet MVP UX Specification

Product brand: **Timesheet**  
Subtitle: **for Alamo Projects**

This specification defines the MVP screen set from the approved architecture and workflow.

## Global Conventions

### Status chips (workflow)

| Chip | Meaning | Color intent |
|---|---|---|
| `Draft` | Employee editing in progress | Neutral gray |
| `Submitted` | Awaiting manager decision | Blue |
| `Manager Approved` | Approved by manager, awaiting payroll | Indigo |
| `Manager Rejected` | Rejected by manager, returned to employee | Red |
| `Payroll Validated` | Payroll checks passed, ready to export/lock | Green |
| `Locked` | Period closed, read-only | Dark neutral |

### Derived chips (non-workflow flags)

| Chip | Meaning |
|---|---|
| `Has Exceptions` | Payroll validation exceptions exist |
| `Export Ready` | No blocking exceptions; can create export batch |
| `In Revision` | Temporary controlled unlock path is active |

### Deterministic interaction rules

- All calculations are server-authoritative and deterministic by policy version.
- All role actions are enabled/disabled strictly by role + current workflow status.
- Blocking errors prevent state transitions; warnings do not.
- Every create/update/delete/state transition writes field-level audit events.
- Footer appears on every screen and document: `Innoweb Ventures Limited`.

## 1) Screen: Sign In

### 1.1 Layout (desktop + mobile)

- Desktop: centered sign-in card, brand at top (`Timesheet` + `for Alamo Projects`), help links below form.
- Mobile: full-width single-column form, sticky primary button at bottom of viewport.

### 1.2 Field definitions and behaviors

| Field | Type | Behavior |
|---|---|---|
| Email | Text/email | Trim whitespace, lowercase normalization. |
| Password | Password | Masked input, show/hide toggle. |
| Remember this device | Checkbox | Extends session according to auth policy. |
| Sign In | Primary button | Submits only when mandatory fields are non-empty. |

### 1.3 Validation and error states

- Invalid email format: inline error below email field.
- Wrong credentials: non-specific error banner.
- Locked account: blocking error with support/contact guidance.
- Network failure: retry banner with deterministic retry behavior.

### 1.4 Status chips and permitted actions by role/status

- Status chips are not shown on this screen.
- Permitted action for all users: `Sign In`.

### 1.5 Footer

- Fixed footer text: `Innoweb Ventures Limited`.

## 2) Screen: My Timesheets (Employee Period List)

### 2.1 Layout (desktop + mobile)

- Desktop: top filters row, period list table, right-side summary panel.
- Mobile: stacked cards by period with quick status chip and primary action.

### 2.2 Field definitions and behaviors

| Field | Type | Behavior |
|---|---|---|
| Period | Date range | Read-only period label from `calendar_periods`. |
| Status chip | Chip | Derived from workflow state. |
| Total hours | Numeric | Read-only aggregate from saved calculations. |
| Last updated | Date/time | Shows latest edit or transition timestamp. |
| Primary action | Button | Dynamic label (`Open`, `View`, `Resubmit`). |

### 2.3 Validation and error states

- Empty list: informational empty state with current open period prompt.
- Data load error: retry banner and non-destructive fallback.

### 2.4 Status chips and permitted actions by role/status

| Role | Status | Allowed actions |
|---|---|---|
| Employee | `Draft` | Open, Edit, Save, Submit |
| Employee | `Submitted` | View only |
| Employee | `Manager Rejected` | Open, Edit, Resubmit |
| Employee | `Manager Approved` | View only |
| Employee | `Payroll Validated` | View only |
| Employee | `Locked` | View only |

### 2.5 Footer

- Fixed footer text: `Innoweb Ventures Limited`.

## 3) Screen: Timesheet Editor (Paper-Like Daily Grid)

### 3.1 Layout (desktop + mobile)

- Desktop: paper-like grid with one visible row per day, sticky column headers, sticky right totals panel.
- Mobile: day-card list with swipe/next-day navigation and compact totals drawer.

### 3.2 Field definitions and behaviors

| Column/Field | Type | Behavior |
|---|---|---|
| Day | Read-only | Mon-Sun label; sourced from calendar rules. |
| Date | Read-only | Exact date in period. |
| Day Type | Read-only chip | Workday/Weekend/Public Holiday/Configured type. |
| Start | Time | Required for worked day rows unless leave code chosen. |
| Finish | Time | Required with Start; must be after Start. |
| Break (mins) | Numeric/select | Applies break policy and rounding rules. |
| Leave/Absence Code | Select | Mutually exclusive with Start/Finish. |
| Notes | Text | Optional; character limit and audit-captured. |
| Normal hrs | Read-only numeric | Deterministic computed output. |
| OT hrs | Read-only numeric | Computed from `overtime_rules`. |
| PH worked hrs | Read-only numeric | Computed from `public_holiday_rules`. |
| Leave hrs | Read-only numeric | Computed from leave code rules. |
| Day total | Read-only numeric | Sum of payable/leave components as configured. |

### 3.3 Paper-like grid behavior (weekly totals + period totals)

- Grid emulates printed timesheet structure with full-week bands.
- Weekly subtotal row appears after each week:
  - `Weekly Normal`
  - `Weekly OT`
  - `Weekly PH Worked`
  - `Weekly Leave`
  - `Weekly Total`
- Period summary panel is always visible:
  - `Period Normal`
  - `Period OT`
  - `Period PH Worked`
  - `Period Leave`
  - `Period Grand Total`
- Recalculation triggers on field blur and explicit save.
- Keyboard-first entry:
  - `Tab` moves cell-to-cell.
  - `Enter` commits current row.
  - Arrow keys move across day rows.
- Deterministic rounding and thresholds always use active policy version.

### 3.4 Validation and error states

- Blocking inline errors:
  - Missing Start or Finish on worked row.
  - `Finish <= Start`.
  - Overlapping intervals in same day.
  - Work entry plus leave code on same row.
  - Exceeds configured daily/weekly maximum.
- Non-blocking warnings:
  - Unusual long day threshold reached.
  - Note recommended for exceptional entries.
- Error summary panel lists row + column references.
- `Submit` disabled until blocking errors are cleared.

### 3.5 Status chips and permitted actions by role/status

| Role | Status | Allowed actions |
|---|---|---|
| Employee | `Draft` | Edit rows, Save draft, Submit |
| Employee | `Manager Rejected` | Edit rows, Save draft, Resubmit |
| Employee | `Submitted` | View only |
| Employee | `Manager Approved` | View only |
| Employee | `Payroll Validated` | View only |
| Employee | `Locked` | View only |
| Manager/Payroll/Admin | Any | View only unless in controlled revision authority |

### 3.6 Footer

- Fixed footer text: `Innoweb Ventures Limited`.

## 4) Screen: Submit Review (Validation Summary)

### 4.1 Layout (desktop + mobile)

- Desktop: modal over editor with two-column summary (totals left, checks right).
- Mobile: full-screen sheet with sticky submit/resubmit action bar.

### 4.2 Field definitions and behaviors

| Field | Type | Behavior |
|---|---|---|
| Period totals | Read-only summary | Displays final computed totals by category. |
| Validation checks | Read-only list | Blocking vs warning grouped sections. |
| Employee declaration | Checkbox | Required before submit if policy requires. |
| Submit/Resubmit | Primary button | Triggers transition to `Submitted`. |

### 4.3 Validation and error states

- Any blocking validation remains visible and prevents transition.
- Missing declaration blocks submit when enabled by policy.

### 4.4 Status chips and permitted actions by role/status

| Role | Status | Allowed actions |
|---|---|---|
| Employee | `Draft` | Submit |
| Employee | `Manager Rejected` | Resubmit |
| Others | Any | No submit action |

### 4.5 Footer

- Fixed footer text: `Innoweb Ventures Limited`.

## 5) Screen: Manager Approval Queue (Speed Optimized)

### 5.1 Layout (desktop + mobile)

- Desktop: high-density table with sticky filters, selectable rows, and inline actions.
- Mobile: prioritized card queue with quick approve/reject actions.

### 5.2 Field definitions and behaviors

| Field | Type | Behavior |
|---|---|---|
| Employee | Text | Click opens detail drawer/page. |
| Period | Date range | Sortable. |
| Submitted at | Date/time | Sortable by oldest/newest. |
| Total/OT/PH | Numeric trio | Highlights OT/PH for rapid triage. |
| Exceptions indicator | Chip | Shows warnings or policy flags. |
| Status chip | Chip | Must be `Submitted` for actionable rows. |
| Approve | Inline button | One-click action with confirmation preference. |
| Reject | Inline button | Opens reason prompt, mandatory reason. |

### 5.3 Queue speed optimizations

- Default sort: oldest `Submitted` first.
- Saved filters: `All Submitted`, `Has OT/PH`, `Warnings`, `My Team`.
- Keyboard shortcuts:
  - `J/K` move row focus.
  - `A` approve focused row.
  - `R` reject focused row.
  - `/` focus search.
- Optional split view: left queue + right read-only preview to reduce page switches.
- Bulk approve enabled only for rows with no blocking warnings and no OT/PH confirmation required.

### 5.4 Validation and error states

- Approve blocked when mandatory manager confirmation for OT/PH is missing.
- Reject blocked until reason is provided.
- Concurrent update handling: optimistic lock conflict prompts refresh.

### 5.5 Status chips and permitted actions by role/status

| Role | Status | Allowed actions |
|---|---|---|
| Manager | `Submitted` | Open detail, Approve, Reject |
| Manager | `Manager Approved` | View only |
| Manager | `Manager Rejected` | View only |
| Payroll/Admin | `Submitted` | View only |
| Employee | Any | No access to manager queue |

### 5.6 Footer

- Fixed footer text: `Innoweb Ventures Limited`.

## 6) Screen: Manager Review Detail

### 6.1 Layout (desktop + mobile)

- Desktop: header with employee/period/status, timesheet grid preview, decision panel on right.
- Mobile: stacked sections with sticky approve/reject bar.

### 6.2 Field definitions and behaviors

| Field | Type | Behavior |
|---|---|---|
| Employee and period metadata | Read-only | Includes submitted timestamp and prior revision count. |
| OT/PH confirmation toggle | Boolean | Required when OT/PH worked hours > 0. |
| Decision notes | Text | Optional on approve, required on reject if policy requires. |
| Approve | Primary button | Sets status to `Manager Approved`. |
| Reject | Danger button | Sets status to `Manager Rejected` with reason. |

### 6.3 Validation and error states

- Approve blocked if OT/PH confirmation required and unchecked.
- Reject blocked without reason.
- Decision conflict shows stale data warning if record changed in queue.

### 6.4 Status chips and permitted actions by role/status

| Role | Status | Allowed actions |
|---|---|---|
| Manager | `Submitted` | Approve, Reject |
| Manager | `Manager Approved` | View only |
| Manager | `Manager Rejected` | View only |
| Payroll/Admin | `Manager Approved` | View only |
| Employee | Any | View via employee screens only |

### 6.5 Footer

- Fixed footer text: `Innoweb Ventures Limited`.

## 7) Screen: Payroll Validation Dashboard (Exceptions First)

### 7.1 Layout (desktop + mobile)

- Desktop: KPI row, left exception list, center record detail, right readiness checklist.
- Mobile: tabbed panels (`Exceptions`, `Detail`, `Readiness`, `Batches`).

### 7.2 Field definitions and behaviors

| Field | Type | Behavior |
|---|---|---|
| Awaiting payroll count | KPI | Count of `Manager Approved` timesheets pending payroll action. |
| Exceptions count | KPI | Count of records with blocking payroll exceptions. |
| Export-ready count | KPI | Count passing all payroll checks. |
| Exception list | Table/list | Filter by rule code, severity, team, period. |
| Readiness checklist | Rules list | Deterministic pass/fail set for export eligibility. |
| Validate selected | Button | Runs payroll validation for selected records. |
| Mark Payroll Validated | Button | Allowed only when no blocking exceptions remain. |

### 7.3 Validation and error states

- Any blocking exception prevents `Payroll Validated`.
- Rule code and failing field are shown for each exception.
- System errors do not change workflow state and show retry prompt.

### 7.4 Status chips and permitted actions by role/status

| Role | Status | Allowed actions |
|---|---|---|
| Payroll | `Manager Approved` | Run validation, Resolve exceptions, Mark Payroll Validated |
| Payroll | `Payroll Validated` | View, Prepare export |
| Payroll | `Locked` | View only |
| Manager/Admin | `Manager Approved` | View only |
| Employee | Any | No access |

### 7.5 Footer

- Fixed footer text: `Innoweb Ventures Limited`.

## 8) Screen: Exception Resolution (Controlled Revision)

### 8.1 Layout (desktop + mobile)

- Desktop: exception detail on top, revision controls and audit preview below.
- Mobile: step-by-step flow (`Exception` -> `Action` -> `Confirm`).

### 8.2 Field definitions and behaviors

| Field | Type | Behavior |
|---|---|---|
| Exception code | Read-only | Deterministic policy/rule identifier. |
| Affected field(s) | Read-only | Exact field path(s) that failed. |
| Resolution action | Select | `Return to Employee` or `Controlled Unlock`. |
| Resolution reason | Text | Mandatory; stored in workflow + audit event. |
| Effective assignee | Select | Required for return path routing. |
| Confirm action | Button | Executes governed transition/events. |

### 8.3 Validation and error states

- Action blocked without reason.
- `Controlled Unlock` blocked if user lacks revision authority.
- Locked period edits blocked unless explicit `In Revision` state is active.

### 8.4 Status chips and permitted actions by role/status

| Role | Status | Allowed actions |
|---|---|---|
| Payroll | `Manager Approved` | Return to Employee, Controlled Unlock |
| Admin | `Manager Approved` or `Payroll Validated` | Controlled Unlock (policy permitting) |
| Payroll/Admin | `Locked` | Controlled Unlock only if policy permits |
| Manager/Employee | Any | No exception-resolution actions |

### 8.5 Footer

- Fixed footer text: `Innoweb Ventures Limited`.

## 9) Screen: Export Batch Center

### 9.1 Layout (desktop + mobile)

- Desktop: split layout with `Create Batch` panel and `Batch History` table.
- Mobile: create form first, expandable list for history.

### 9.2 Field definitions and behaviors

| Field | Type | Behavior |
|---|---|---|
| Export profile | Select | Uses deterministic field mapping template. |
| Period | Select | Shows only payroll-validated, unlocked candidates. |
| Include records count | Read-only | Computed from current filters/status. |
| Create batch | Primary button | Generates unique batch ID and immutable snapshot. |
| Download CSV | Button | Enabled when CSV output generated. |
| Download XLSX | Button | Enabled when XLSX output generated. |
| Batch ID | Read-only | Unique sequence from `export_batch_policy`. |
| Batch status | Chip | `Generated`, `Downloaded`, `Archived` as batch lifecycle. |

### 9.3 Validation and error states

- Batch creation blocked if selected set is not `Export Ready`.
- Duplicate batch prevention by snapshot hash + uniqueness rule.
- Download failure prompts retry without regenerating batch ID.

### 9.4 Status chips and permitted actions by role/status

| Role | Status | Allowed actions |
|---|---|---|
| Payroll | `Payroll Validated` | Create batch, Download files |
| Payroll | `Locked` | Download existing batch only |
| Admin | `Payroll Validated` or `Locked` | View/download per permissions |
| Employee/Manager | Any | No export actions |

### 9.5 Footer

- Fixed footer text: `Innoweb Ventures Limited`.

## 10) Screen: Period Lock Center

### 10.1 Layout (desktop + mobile)

- Desktop: period list with lock-state chips and action column.
- Mobile: period cards with status and lock/unlock detail drawer.

### 10.2 Field definitions and behaviors

| Field | Type | Behavior |
|---|---|---|
| Period | Date range | Selectable for lock action. |
| Current lock state | Chip | `Open`, `In Revision`, `Locked`. |
| Lock eligibility | Read-only checklist | All records payroll validated, batch completed per policy. |
| Lock period | Primary button | Moves eligible period to `Locked`. |
| Controlled unlock | Secondary button | Opens unlock reason flow if allowed. |

### 10.3 Validation and error states

- Lock blocked if payroll validation incomplete.
- Unlock blocked when outside configured revision window or missing authority.
- All lock/unlock failures show deterministic reason code.

### 10.4 Status chips and permitted actions by role/status

| Role | Status | Allowed actions |
|---|---|---|
| Payroll | `Payroll Validated` | Lock period |
| Payroll | `Locked` | View only unless unlock authority granted |
| Admin | `Locked` | Controlled unlock if policy permits |
| Employee/Manager | Any | View only or no access per policy |

### 10.5 Footer

- Fixed footer text: `Innoweb Ventures Limited`.

## 11) Screen: Audit Trail Explorer

### 11.1 Layout (desktop + mobile)

- Desktop: filter rail on left, audit event table center, field-diff panel right.
- Mobile: filter drawer + expandable event cards.

### 11.2 Field definitions and behaviors

| Field | Type | Behavior |
|---|---|---|
| Entity type | Select | Timesheet, row, workflow event, export batch, policy. |
| Entity ID | Search | Direct jump to entity history. |
| Actor | Select/search | Filter by user who made change. |
| Action type | Select | Create, Update, Delete, Transition, Export, Lock. |
| Date range | Date range | Filter event timestamps. |
| Field diffs | Read-only | Before/after values at field level. |

### 11.3 Validation and error states

- Invalid filter combinations show immediate inline guidance.
- No results state includes current filters summary.
- Sensitive fields apply masking/redaction rules from audit policy.

### 11.4 Status chips and permitted actions by role/status

| Role | Status | Allowed actions |
|---|---|---|
| Admin | Any | Full audit search and detail access |
| Payroll | Any | Read access to payroll-related entities |
| Manager | Team scope | Read access to manager/team workflow events |
| Employee | Own records only | Read access to own audit history |

### 11.5 Footer

- Fixed footer text: `Innoweb Ventures Limited`.

## 12) Screen: Policy Configuration (Admin)

### 12.1 Layout (desktop + mobile)

- Desktop: left navigation by policy domain, editable form/table panel, publish sidebar.
- Mobile: accordion sections per policy domain with staged save.

### 12.2 Field definitions and behaviors

| Field group | Type | Behavior |
|---|---|---|
| Calendar periods | Table/form | Define start/end, submission windows, lock windows. |
| Day type rules | Table/form | Map weekdays/holidays/custom rules to day types. |
| Paid hours profiles | Table/form | Set standard hours, breaks, rounding increments. |
| Leave/absence codes | Table/form | Configure code, paid flag, export mapping. |
| OT/PH rules | Rule editor | Deterministic thresholds and multipliers. |
| Validation rules | Rule table | Enable/disable, severity, parameters. |
| Publish policy version | Action | Creates immutable version used by future calculations. |

### 12.3 Validation and error states

- Rule conflicts blocked before publish with exact conflict detail.
- Missing required mapping blocks publish.
- Existing timesheets remain tied to historical rule version.

### 12.4 Status chips and permitted actions by role/status

| Role | Status | Allowed actions |
|---|---|---|
| Admin | Any | View/edit/publish policy versions |
| Payroll | Any | View only |
| Manager/Employee | Any | No access |

### 12.5 Footer

- Fixed footer text: `Innoweb Ventures Limited`.

## Appendix A: Role and State Action Matrix (Authoritative)

| Role | `Draft` | `Submitted` | `Manager Approved` | `Manager Rejected` | `Payroll Validated` | `Locked` |
|---|---|---|---|---|---|---|
| Employee | Edit/Submit | View | View | Edit/Resubmit | View | View |
| Manager | View | Approve/Reject | View | View | View | View |
| Payroll | View | View | Validate/Resolve | View | Export/Lock | View or controlled unlock |
| Admin | Configure/View | Configure/View | Configure/View | Configure/View | Configure/View | Controlled unlock (policy) |

All actions above are constrained by deterministic workflow transition rules and audit logging.
