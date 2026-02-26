# Timesheet MVP Test Plan and UAT Scripts

Product: **Timesheet**  
Subtitle: **for Alamo Projects**  
Footer requirement on all UI/documents: **Innoweb Ventures Limited**

Workflow under test:

`DRAFT -> SUBMITTED -> MANAGER_APPROVED / MANAGER_REJECTED -> PAYROLL_VALIDATED -> LOCKED`

---

## 1) Test Matrix

### 1.1 Test scope

- In scope: auth, RBAC, timesheet entry/calculation/validation, manager approval, payroll validation, export, lock/unlock, audit trail.
- Out of scope: external payroll system ingestion beyond file generation/download.

### 1.2 Test data baseline

- Employees:
  - `E1001` Employee
  - `E2001` Manager
  - `E3001` Payroll
  - `E9001` Admin
- Period:
  - `2026-02-16` to `2026-02-22`
- Policy defaults:
  - leave paid default: `8.0` hours/day
  - Friday short day: `6.0` hours/day
  - early knock-off paid full day: configurable true/false
  - PH not worked code: `PH`

### 1.3 Matrix

| ID | Area | Role | Precondition | Test | Expected Result |
|---|---|---|---|---|---|
| HP-EMP-01 | Happy path | Employee | User active | Login and open current period | Dashboard loads; period visible with `Draft` |
| HP-EMP-02 | Happy path | Employee | Draft exists | Enter week rows and save draft | Rows persist; totals computed |
| HP-EMP-03 | Happy path | Employee | Valid rows, no blocking errors | Submit timesheet | Status changes to `Submitted`; submit event audited |
| HP-MGR-01 | Happy path | Manager | Submitted timesheet exists | Open queue | Timesheet appears in queue |
| HP-MGR-02 | Happy path | Manager | No OT/PH worked | Approve timesheet | Status becomes `Manager Approved` |
| HP-MGR-03 | Happy path | Manager | OT or PH worked > 0 | Approve with required confirmations | Approval accepted only with confirmations |
| HP-PAY-01 | Happy path | Payroll | Manager-approved timesheet | Run payroll validation | No blocking exceptions; ready to validate |
| HP-PAY-02 | Happy path | Payroll | Validation passed | Mark payroll validated | Status becomes `Payroll Validated` |
| HP-PAY-03 | Happy path | Payroll | Validated records exist | Create export batch and download CSV/XLSX | Batch created; files downloadable |
| HP-PAY-04 | Happy path | Payroll | Period export complete | Lock period | Period status becomes `Locked` |
| HP-ADM-01 | Happy path | Admin | Admin auth | Create/update calendar rules draft and publish | New published ruleset available |
| HP-ADM-02 | Happy path | Admin | Audit data exists | Query audit by entity and actor | Correct ordered events/diffs returned |
| HP-BRAND-01 | Branding | All | App running | Navigate all MVP screens | Footer always shows `Innoweb Ventures Limited` |
| VAL-TIME-01 | Validation time | Employee | Draft editable | Set finish earlier than start | Blocking error on finish; cannot submit |
| VAL-TIME-02 | Validation time | Employee | Draft editable | Enter start only | Blocking error: start/finish pair required |
| VAL-TIME-03 | Validation time | Employee | Draft editable | Enter finish only | Blocking error: start/finish pair required |
| VAL-TIME-04 | Validation time | Employee | Draft editable | Break >= shift length | Blocking error on break |
| VAL-TIME-05 | Validation time | Employee | Max daily policy configured | Enter impossible daily hours | Blocking error: impossible hours |
| VAL-TIME-06 | Validation time | Employee | Multi-line day enabled | Create overlapping row times | Blocking overlap error |
| VAL-ABS-01 | Validation leave/absence | Employee | Draft editable | Select absence code | Start/finish disabled and blank |
| VAL-ABS-02 | Validation leave/absence | Employee | Absence selected | Try entering start/finish via API/UI | Blocked; invalid combo error |
| VAL-PH-01 | Validation PH | Employee | Date is public holiday, no worked time | Save without `PH` code | Blocking error: PH code required |
| VAL-PH-02 | Validation PH | Employee | `absence_code=PH` | Enter worked time | Blocking invalid combo error |
| VAL-LEAVE-01 | Validation leave | Employee | Leave code paid | Enter 1 day leave | Leave hours default to 8.0 |
| VAL-LEAVE-02 | Validation leave | Admin+Employee | Override leave hours policy | Enter leave again | Leave hours follow configured override |
| VAL-EKO-01 | Validation calendar policy | Employee | Early knock-off, pay full day true | Enter reduced worked hours | Normal paid at full-day target |
| VAL-EKO-02 | Validation calendar policy | Employee | Early knock-off, pay full day false | Enter reduced worked hours | Normal paid at configured reduced target |
| VAL-FRI-01 | Validation calendar policy | Employee | Friday short day configured | Enter Friday hours > short target | OT computed after short-day target |
| VAL-TOTAL-01 | Validation totals | Employee | Draft editable | Trigger negative totals scenario | Negative totals blocked |
| VAL-TOTAL-02 | Validation totals | Employee | Daily rows saved | Compare weekly totals | Weekly totals equal daily sums |
| VAL-TOTAL-03 | Validation totals | Employee | Weekly totals available | Compare period totals | Period totals equal sum of weekly totals |
| WF-01 | Workflow | Employee | Draft timesheet | Submit | Allowed only from `Draft` |
| WF-02 | Workflow | Employee | Status `Submitted` | Attempt edit | Edit blocked (status not editable) |
| WF-03 | Workflow | Manager | Status `Submitted` | Reject without reason | Blocked; reason required |
| WF-04 | Workflow | Employee | Status `Manager Rejected` | Edit and resubmit | Status returns to `Submitted`; revision audited |
| WF-05 | Workflow | Manager | OT/PH minutes present | Approve without OT/PH confirm | Blocked with explicit message |
| WF-06 | Workflow | Any | Status `Draft` | Attempt direct lock transition | `409 INVALID_WORKFLOW_TRANSITION` |
| WF-07 | Workflow concurrency | Employee/Manager | Same record open in two sessions | Submit/approve stale version | `409 ROW_VERSION_CONFLICT` |
| LOCK-01 | Locking | Payroll | Period not payroll validated | Attempt lock | Blocked: period not lockable |
| LOCK-02 | Locking | Employee | Period locked | Attempt row update | Blocked by service and DB trigger |
| LOCK-03 | Unlock control | Payroll/Admin | Period locked | Unlock without reason | Blocked; reason required |
| LOCK-04 | Unlock control | Unauthorized role | Period locked | Attempt unlock | `403 FORBIDDEN` |
| LOCK-05 | Lock/Unlock audit | Admin | Lock/unlock performed | Query audit trail | Field-level before/after captured |
| EXP-01 | Export | Payroll | Mix of ready/not-ready records | Create batch | Only export-ready records included |
| EXP-02 | Export | Payroll | Period ready | Create two batches sequentially | Batch IDs unique and sequenced |
| EXP-03 | Export reproducibility | Payroll | Same input data | Re-run export | Existing batch reused or identical checksum |
| EXP-04 | Export integrity | Payroll | Batch generated | Compare `line_count` vs file lines | Counts match |
| EXP-05 | Export integrity | Payroll | Same batch redownload | Recompute file hash | Hash remains identical |
| EXP-06 | Export exceptions | Payroll | Blocking/warning exceptions exist | Download exceptions file | Exception rows match dashboard |
| EXP-07 | Export mapping | Payroll | Leave codes present | Inspect lines file | Leave exported as per-code lines |
| EXP-08 | Export mapping | Payroll | No allocations in MVP | Inspect project/cost columns | Nullable values accepted |
| SEC-01 | Security | Unauthenticated | No token | Access protected endpoint | `401 UNAUTHENTICATED` |
| SEC-02 | RBAC | Employee | Employee token | Access manager queue | `403 FORBIDDEN` |
| SEC-03 | RBAC | Manager | Manager token | Access admin rules endpoints | `403 FORBIDDEN` |
| SEC-04 | RBAC | Payroll | Payroll token | Attempt employee day-entry mutation | `403 FORBIDDEN` |
| SEC-05 | RBAC | Non-admin | Manager/payroll token | Access admin audit endpoints | `403 FORBIDDEN` |
| SEC-06 | Auth session | Any | Valid refresh token | Logout then refresh | Refresh denied after logout |
| SEC-07 | IDOR | Employee | Employee A token | Request Employee B timesheet | `403 FORBIDDEN` |
| SEC-08 | Auth hardening | Public | Repeated login failures | Exceed threshold | Rate-limit/lock controls applied |
| SEC-09 | Idempotency | Manager/Payroll | Idempotency key set | Replay approve/export POST | Same response; no duplicate side effects |
| SEC-10 | Data protection | Any | DB access test harness | Update/delete `audit_event` | Blocked by trigger |
| SEC-11 | Data protection | Any | Locked timesheet exists | Update/delete locked header/entry | Blocked by trigger |
| SEC-12 | Input security | Any | API filter params | Attempt SQL injection payloads | Safely rejected/escaped; no data leak |

---

## 2) UAT Scripts Step-by-Step

### UAT-01 Employee to Payroll end-to-end happy path

1. Login as `E1001` employee.
2. Open current period `2026-02-16` to `2026-02-22`.
3. Enter valid worked rows for all required days.
4. Save draft and confirm weekly/period totals appear.
5. Submit timesheet.
6. Login as `E2001` manager and open queue.
7. Open submitted timesheet and approve.
8. Login as `E3001` payroll and run validation.
9. Mark payroll validated.
10. Create export batch.
11. Download CSV and XLSX.
12. Lock period.

Expected:
- Final status `Locked`.
- Export batch created with unique batch ID.
- Audit trail contains submit, approve, payroll validate, export, lock events.

### UAT-02 Overtime and PH worked approval gate

1. Employee enters overtime day and one public holiday worked day.
2. Employee submits timesheet.
3. Manager attempts approve without OT/PH confirmations.
4. Manager sets required confirmations and re-approves.

Expected:
- Step 3 blocked with OT/PH confirmation requirement.
- Step 4 succeeds and status becomes `Manager Approved`.

### UAT-03 Rejection and resubmission flow

1. Employee submits timesheet with intentionally missing note required by policy.
2. Manager rejects with reason.
3. Employee opens rejected timesheet, corrects data, resubmits.
4. Manager approves corrected submission.

Expected:
- Rejection reason is mandatory and visible to employee.
- Resubmission allowed only from `Manager Rejected`.
- Audit trail shows reject reason and subsequent resubmit transition.

### UAT-04 Validation rules: absence/leave/PH/time logic

1. Employee selects absence code and attempts to enter start/finish.
2. Employee sets finish earlier than start on a worked row.
3. Employee on PH-not-worked day leaves absence blank.
4. Employee records leave code on one day.
5. Admin changes leave paid-hours policy and employee re-tests leave entry.

Expected:
- Invalid combos/time sequence blocked with field highlights.
- PH-not-worked requires `PH` code.
- Leave defaults to 8.0 hours/day then changes per new policy.

### UAT-05 Lock/unlock with reason and audit

1. Payroll validates and locks period.
2. Employee attempts edit on locked timesheet.
3. Payroll/Admin initiates unlock without reason.
4. Payroll/Admin unlocks with reason.
5. Admin queries audit event trail for period/timesheet.

Expected:
- Locked edits blocked.
- Unlock without reason blocked.
- Unlock with reason succeeds only for authorized role.
- Audit includes lock/unlock reason and field-level changes.

### UAT-06 Export reproducibility and rerun consistency

1. Payroll creates export batch for period.
2. Capture batch metadata (`batch_id`, `checksum_sha256`, `line_count`).
3. Re-run export with same input set.
4. Download outputs from both runs.
5. Compare hashes and row ordering.

Expected:
- Same inputs return existing batch or identical checksum/content.
- Line ordering deterministic.
- `line_count` equals actual exported lines.

### UAT-07 Payroll exceptions workflow

1. Prepare one timesheet missing manager approval and one with missing day coverage.
2. Payroll opens exceptions dashboard.
3. Validate period and review exception list.
4. Attempt mark payroll validated with blocking exceptions present.

Expected:
- Exceptions listed with rule codes and blocking flags.
- Payroll validation transition blocked until blocking exceptions resolved.

### UAT-08 RBAC and security smoke

1. Employee attempts manager queue endpoint/page.
2. Manager attempts admin rules endpoint/page.
3. Payroll attempts employee day-entry update endpoint.
4. Non-admin attempts audit endpoints.
5. Call protected endpoint without token.

Expected:
- All unauthorized actions return `403`.
- Missing auth returns `401`.
- No protected data leakage in responses.

---

## 3) Edge Cases and Expected Results

| Edge Case ID | Scenario | Expected Result |
|---|---|---|
| EC-01 | Public holiday overlaps Friday short day | PH precedence applied deterministically |
| EC-02 | Public holiday overlaps early knock-off | PH precedence applied deterministically |
| EC-03 | Early knock-off with pay-full-day true | Normal paid at full-day target |
| EC-04 | Early knock-off with pay-full-day false | Normal paid at configured reduced target |
| EC-05 | Leave code and worked time entered same row | Blocking invalid combo error |
| EC-06 | Absence selected via API with start/finish values | Validation rejects payload; no partial commit |
| EC-07 | Daylight saving transition day | Duration calculation remains consistent with timezone rules |
| EC-08 | Cross-midnight shift entry in MVP | Rejected or split per policy; no ambiguous totals |
| EC-09 | Weekly OT threshold reached exactly at boundary | OT computed as zero excess at exact boundary |
| EC-10 | Weekly OT threshold exceeded by small amount | OT equals precise excess minutes |
| EC-11 | Two managers attempt decision concurrently | One succeeds; stale actor gets `409 ROW_VERSION_CONFLICT` |
| EC-12 | Employee edits after submit using stale UI | Blocked by status and/or row version checks |
| EC-13 | Attempt direct transition `Draft -> Locked` | `409 INVALID_WORKFLOW_TRANSITION` |
| EC-14 | Attempt payroll validate without manager approval | Blocked with status conflict |
| EC-15 | Lock request with unvalidated timesheets in period | Blocked: period not lockable |
| EC-16 | Unlock request by unauthorized role | `403 FORBIDDEN` |
| EC-17 | Unlock request without reason | `422` validation error |
| EC-18 | Update/delete locked timesheet row via SQL/API | Blocked by trigger/service guard |
| EC-19 | Update/delete audit rows | Blocked by append-only trigger |
| EC-20 | Export re-run after no data changes | Same checksum and identical row ordering |
| EC-21 | Export re-run after one timesheet changed | New batch/signature created; differences traceable |
| EC-22 | Duplicate idempotency key replay | Same response, no duplicate state changes |
| EC-23 | Period creation overlapping existing period | Blocked by exclusion constraint |
| EC-24 | Employee timezone differs from ruleset timezone | Date classification follows configured rule evaluation policy |
| EC-25 | Footer missing on one screen/export print template | Fails branding acceptance test |

---

## UAT Acceptance Criteria

1. All Happy Path tests pass.
2. All blocking validation tests pass with correct field-level errors.
3. All workflow and lock/unlock control tests pass with proper audit evidence.
4. Export reproducibility tests pass (`same inputs -> same checksum/results`).
5. RBAC/security tests pass with no unauthorized data access.
6. Branding footer requirement passes on all screens and exported printable artifacts.

