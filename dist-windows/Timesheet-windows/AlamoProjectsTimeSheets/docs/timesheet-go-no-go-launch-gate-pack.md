# Timesheet Go/No-Go Launch Gate Pack

Product: **Timesheet**  
Subtitle: **for Alamo Projects**  
Footer requirement on all UI/PDF artifacts: **Innoweb Ventures Limited**

## 1) Gate Checklist (Go/No-Go Criteria)

Legend:

- `MANDATORY`: must pass for Go.
- `CONDITIONAL`: can proceed only with approved risk waiver and owner/date.

### 1.1 UAT pass criteria

| Gate ID | Check | Threshold | Type | Evidence |
|---|---|---|---|---|
| UAT-01 | UAT test execution complete | 100% planned scenarios executed | MANDATORY | UAT report |
| UAT-02 | Critical defects | 0 open `P1` / `P2` | MANDATORY | Defect dashboard |
| UAT-03 | High defects | <= 3 open `P3`, all with workaround | CONDITIONAL | Defect log + waiver |
| UAT-04 | Workflow coverage | All states validated (`Draft -> Submitted -> Manager Approved/Rejected -> Payroll Validated -> Locked`) | MANDATORY | Test evidence |
| UAT-05 | Validation behavior | All blocking validations confirmed (time/leave/PH/conflicts) | MANDATORY | Test evidence |
| UAT-06 | Lock/revision controls | Lock/unlock/revision flow tested with reasons and audit evidence | MANDATORY | Audit screenshots/logs |
| UAT-07 | Branding | Footer present on all screens and generated docs | MANDATORY | UI/PDF checks |

### 1.2 Payroll export sign-off items

| Gate ID | Check | Threshold | Type | Evidence |
|---|---|---|---|---|
| PAY-01 | Export mapping | Columns match approved spec and code mappings | MANDATORY | Mapping sign-off |
| PAY-02 | Reconciliation accuracy | >= 99% rows within tolerance; all deltas explained | MANDATORY | Reconciliation report |
| PAY-03 | Export reproducibility | Same inputs => same checksum/content (or same batch reuse) | MANDATORY | Repeat-run comparison |
| PAY-04 | Batch traceability | Every export line links to exact timesheet revision | MANDATORY | DB query evidence |
| PAY-05 | Exception handling | Blocking exceptions prevent payroll validate/export | MANDATORY | Validation tests |
| PAY-06 | Payroll operational approval | Payroll lead sign-off on runbook and outputs | MANDATORY | Signed checklist |

### 1.3 Security + backup/restore checks

| Gate ID | Check | Threshold | Type | Evidence |
|---|---|---|---|---|
| SEC-01 | RBAC verification | 100% critical endpoint-role tests pass | MANDATORY | RBAC test report |
| SEC-02 | Auth controls | Password policy, rate limits, token rotation active | MANDATORY | Config + tests |
| SEC-03 | Audit protection | Audit tables append-only protection verified | MANDATORY | DB trigger test |
| SEC-04 | Vulnerability posture | 0 open critical/high exploitable findings | MANDATORY | Security scan report |
| SEC-05 | Secrets hygiene | No secrets in repo/logs; secret manager configured | MANDATORY | CI scan + config check |
| BAK-01 | Backup success | Latest backup < 24h old and checksum verified | MANDATORY | Backup log |
| BAK-02 | Restore drill | Successful restore drill in staging within last 14 days | MANDATORY | Drill report |
| BAK-03 | RPO/RTO readiness | RPO and RTO targets met in drill | CONDITIONAL | Drill metrics |

### 1.4 Performance thresholds

| Gate ID | Metric | Threshold | Type | Evidence |
|---|---|---|---|---|
| PERF-01 | API p95 latency (read) | < 500 ms | MANDATORY | APM/dashboard |
| PERF-02 | API p95 latency (mutation) | < 800 ms | MANDATORY | APM/dashboard |
| PERF-03 | Error rate 5xx | < 1% sustained (15 min) | MANDATORY | Monitoring |
| PERF-04 | Export batch generation | p95 < 120 sec (pilot-size baseline), no timeout failures | MANDATORY | Export metrics |
| PERF-05 | Manager queue load | p95 load time < 2 sec under pilot peak | CONDITIONAL | Frontend telemetry |
| PERF-06 | DB saturation | active connections < 85% pool cap at peak | MANDATORY | DB metrics |

### 1.5 Go/No-Go decision rule

- **Go**: all `MANDATORY` items pass, and any `CONDITIONAL` exceptions have approved waiver.
- **No-Go**: one or more `MANDATORY` items fail or no approved owner for residual risk.

---

## 2) Sign-Off Template

Use this template for launch approval meeting.

## 2.1 Release metadata

| Field | Value |
|---|---|
| Release name | |
| Release version/tag | |
| Planned cutover date/time (UTC/local) | |
| Deployment environment | Production |
| Change ticket / CAB reference | |
| Release manager | |

## 2.2 Gate results summary

| Domain | Result (`PASS`/`FAIL`/`WAIVED`) | Evidence link | Owner | Notes |
|---|---|---|---|---|
| UAT | | | | |
| Payroll export | | | | |
| Security | | | | |
| Backup/restore | | | | |
| Performance | | | | |
| Observability/alerting | | | | |
| Runbooks/operations | | | | |

## 2.3 Risk acceptance (only if needed)

| Risk ID | Description | Impact | Mitigation | Owner | Expiry date | Approved by |
|---|---|---|---|---|---|---|
| | | | | | | |

## 2.4 Required signatories

| Role | Name | Decision (`GO`/`NO-GO`) | Date/Time | Signature |
|---|---|---|---|---|
| Product owner | | | | |
| Payroll lead | | | | |
| Engineering lead | | | | |
| Security lead | | | | |
| Operations/DevOps lead | | | | |
| Release manager | | | | |

Final decision:

- Launch decision: `GO / NO-GO`
- Decision rationale:

---

## 3) Final Release Steps (Cutover + Rollback)

## 3.1 Production cutover steps

### T-24h to T-2h (pre-cutover)

1. Freeze non-release changes.
2. Confirm final image tags and env configuration.
3. Run final backup and verify checksum.
4. Validate monitoring dashboards and on-call rota.
5. Confirm rollback package:
  - previous stable image tag
  - latest valid DB backup and restore command
6. Confirm communications draft for launch status updates.

### T-0 (deployment window)

1. Put support team on live bridge.
2. Pull release images.
3. Run DB migrations (backward-compatible only).
4. Deploy API then Web, keep reverse proxy healthy.
5. Run smoke checks:
  - login
  - timesheet save + submit
  - manager approve
  - payroll validate
  - export batch create/download
  - lock period
6. Validate dashboards:
  - error rates
  - latency
  - DB health
  - alert status
7. Announce “launch complete - monitoring period started”.

### T+0 to T+24h (hypercare)

1. Monitor key SLOs every 30 minutes for first 4 hours.
2. Track exceptions/backlog and reconciliation variance.
3. Publish status updates at agreed cadence.
4. Close launch when stability criteria met.

## 3.2 Rollback steps (if trigger met)

Rollback triggers:

- Any P1 incident without workaround within SLA.
- Payroll export integrity failure (checksum mismatch/non-repeatable outputs).
- Security control failure (RBAC bypass, audit write failure).
- Error/latency breach sustained beyond agreed threshold.

Rollback procedure:

1. Declare incident and open rollback bridge.
2. Stop further state transitions (submit/approve/export/lock endpoints via maintenance guard if available).
3. Roll back API/Web to previous stable image tag.
4. If required, restore DB from pre-cutover backup (with explicit approval).
5. Run post-rollback smoke checks.
6. Communicate rollback completion and impact summary.
7. Record postmortem actions and re-entry criteria.

## 3.3 Re-entry criteria after rollback

1. Root cause fixed and validated in staging.
2. UAT regression on impacted areas passes.
3. Reconciliation dry run passes.
4. Security and backup checks re-validated.
5. New Go/No-Go sign-off completed.

