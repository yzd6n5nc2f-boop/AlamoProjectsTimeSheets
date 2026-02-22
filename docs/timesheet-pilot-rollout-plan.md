# Timesheet Pilot Rollout Plan (2 Weeks)

Product: **Timesheet**  
Subtitle: **for Alamo Projects**  
Footer requirement on all pilot UI/docs/PDFs: **Innoweb Ventures Limited**

## 1) Pilot Group Selection

## 1.1 Selection goals

- Validate end-to-end flow across all roles (`Employee`, `Manager`, `Payroll`, `Admin`).
- Cover edge-case patterns (OT, PH worked, leave codes, rejected/resubmitted sheets).
- Keep scope controlled enough for rapid issue handling.

## 1.2 Pilot cohort composition (recommended)

- Employees: 25 to 40 users total
  - 10 standard schedule users
  - 8 users with frequent overtime
  - 5 users with regular leave/absence entries
  - 2 to 5 users in public-holiday-heavy locations
- Managers: 4 to 6 (covering pilot employees)
- Payroll: 2
- Admin/config owners: 1 to 2

## 1.3 Selection criteria

- Mix of teams/projects/cost-code usage.
- Include at least one team with Friday short-day policy and one with early knock-off policy.
- Include users with previous payroll discrepancy history (for reconciliation confidence).
- Exclude users on leave for most of pilot window.

---

## 2) Two-Week Pilot Plan

## 2.1 Pilot mode

- Run **parallel payroll** for 2 full weekly cycles:
  - Existing process remains source of truth for payment.
  - Timesheet pilot runs side-by-side and is reconciled daily and at period close.

## 2.2 Week-by-week schedule

| Day | Focus | Activities | Outputs |
|---|---|---|---|
| W1-D1 | Kickoff + access | Pilot kickoff, account verification, role checks, environment smoke tests | Pilot participants confirmed, access signoff |
| W1-D2 | Employee onboarding | Employee training + first entries in Timesheet, support desk open | First draft entries submitted |
| W1-D3 | Manager onboarding | Manager queue training, approve/reject practice on pilot data | Manager review SLA baseline |
| W1-D4 | Payroll onboarding | Payroll validation/exceptions/export walkthrough | Exception triage playbook |
| W1-D5 | Week 1 close | Parallel comparison vs existing sheets, defect triage, config updates (if approved) | Week 1 reconciliation report |
| W2-D1 | Controlled adjustments | Deploy approved low-risk fixes/config tweaks, communicate changes | Change log v1 |
| W2-D2 | Full flow run | Repeat full cycle entry -> approval -> payroll validation | Throughput and error trend data |
| W2-D3 | Export deep check | Batch generation/re-run consistency checks, CSV/XLSX checks | Export consistency report |
| W2-D4 | Lock/unlock drill | Controlled period lock/unlock + audit verification | Audit/control evidence |
| W2-D5 | Pilot close | Final reconciliation, success scorecard, go/no-go decision | Pilot exit recommendation |

## 2.3 Parallel run comparisons

Compare pilot output vs existing process for each pilot employee:

- Daily presence/absence classification
- Normal hours
- Overtime hours
- PH worked hours
- Leave hours by code
- Gross paid hours
- Approval statuses and reasons

Tolerance:

- Hours tolerance target: exact match at minute level; if legacy process is hour-rounded, reconcile to agreed rounding policy.
- Any variance above tolerance requires ticket + root cause classification.

---

## 3) Payroll Reconciliation Approach

## 3.1 Reconciliation cadence

- Daily mini-reconciliation for high-risk rows (OT/PH/leave).
- End-of-week full reconciliation for all pilot users.
- End-of-pilot reconciliation summary for two-week period.

## 3.2 Reconciliation workflow

1. Export Timesheet pilot batch (`CSV/XLSX`).
2. Extract equivalent data from existing sheet process.
3. Join by `employee_number + date/period`.
4. Compute deltas by metric:
  - `normal_delta`
  - `ot_delta`
  - `ph_worked_delta`
  - `leave_delta_by_code`
  - `gross_paid_delta`
5. Classify variance:
  - `RULE_DIFFERENCE`
  - `DATA_ENTRY_ERROR`
  - `MISSING_APPROVAL`
  - `ROUNDING_DIFFERENCE`
  - `CONFIG_GAP`
6. Resolve and record disposition.

## 3.3 Reconciliation ownership

- Payroll lead: variance sign-off.
- Product/operations: root-cause tracker.
- Admin/config owner: approved policy/config corrections.

---

## 4) Training Plan

## 4.1 Employee training (45 min)

- Login and period navigation
- Daily grid entry rules (time vs absence code)
- Validation errors and correction workflow
- Submit and resubmission after rejection

Artifacts:

- 1-page quick guide
- 5-minute screen recording
- FAQ for top 10 data-entry errors

## 4.2 Manager training (45 min)

- Queue filters and speed review flow
- OT/PH confirmation requirements
- Rejection reason quality standards
- SLA expectations for approvals

Artifacts:

- Queue operations checklist
- Reject reason examples (good/bad)

## 4.3 Payroll training (60 min)

- Exceptions dashboard and blocking vs warning interpretation
- Override policy boundaries
- Export generation + re-run consistency checks
- Lock/unlock and audit evidence steps

Artifacts:

- Reconciliation worksheet template
- Payroll validation runbook

## 4.4 Admin training (30 min)

- Rule changes with effective-dating discipline
- Change-control process during pilot
- Audit and incident response steps

---

## 5) Feedback Loop and Change Control

## 5.1 Feedback channels

- Daily standup (15 min): pilot leads + payroll + support
- Shared issue board with severity tags:
  - `P1 Payroll risk`
  - `P2 Workflow blocker`
  - `P3 Usability`
- End-of-day digest sent to stakeholders

## 5.2 Change control policy (pilot window)

- Freeze rule/config changes except approved hotfixes.
- Emergency change criteria:
  - payroll-impacting defect
  - data-integrity risk
  - security risk
- Approval chain:
  - Product owner + Payroll lead + Admin
- Every approved change requires:
  - risk note
  - rollback step
  - pilot communication note

## 5.3 Decision gates

- Mid-pilot gate (end of Week 1): continue / pause / rollback.
- Final gate (end of Week 2): go-live candidate / extend pilot / rollback.

---

## 6) Comms Checklist

## 6.1 Pre-pilot

- [ ] Pilot scope, timeline, and participants announced.
- [ ] Responsibilities by role shared.
- [ ] Access and credentials confirmed.
- [ ] Training invites sent and materials distributed.
- [ ] Support channel + escalation contacts published.

## 6.2 During pilot

- [ ] Daily status update sent (adoption, incidents, open blockers).
- [ ] Any config/process change communicated same day.
- [ ] Known issues list updated.
- [ ] Payroll variance summary shared at week close.

## 6.3 End of pilot

- [ ] Final scorecard shared.
- [ ] Go/no-go decision and rationale documented.
- [ ] Next-phase timeline communicated.
- [ ] If rollback/extension: explicit operational instructions issued.

---

## 7) Success Criteria

Use all criteria unless explicitly waived:

## 7.1 Adoption and process

- >= 90% of pilot employees submit in Timesheet on time.
- >= 95% manager decisions completed within SLA.
- Payroll team completes validation/export for pilot scope without manual fallback.

## 7.2 Accuracy and controls

- >= 99% rows reconcile within agreed tolerance.
- 100% blocking exceptions either resolved or documented with approved override.
- 0 unauthorized edits to locked records.
- 100% lock/unlock/revision actions include audit reason.

## 7.3 Reliability

- No P1 unresolved incidents at pilot close.
- Export reproducibility confirmed (same inputs => same checksum/content).
- Security/RBAC tests pass for pilot-critical endpoints.

---

## 8) Exit and Rollback Plan

## 8.1 Exit options

1. **Go-forward**: pilot meets success criteria.
2. **Extend pilot**: non-critical gaps remain, no payroll risk.
3. **Rollback**: material payroll/control risk present.

## 8.2 Rollback triggers

- Reconciliation variance above threshold for 2 consecutive days.
- Unresolved P1 payroll-impacting issue.
- Security/control failure (e.g., unauthorized access, audit failure).
- Export integrity failure (checksum mismatch, non-repeatable outputs).

## 8.3 Rollback steps

1. Declare rollback decision and freeze further pilot transitions.
2. Revert to existing sheet process as sole source of truth.
3. Preserve pilot data as read-only for analysis.
4. Capture incident postmortem with root causes and remediation plan.
5. Communicate revised timeline and re-entry criteria.

## 8.4 Re-entry criteria after rollback

- Root cause fixed and verified in staging.
- Reconciliation dry run passes for sample set.
- Security/RBAC retest pass.
- Payroll lead + product owner sign-off.

