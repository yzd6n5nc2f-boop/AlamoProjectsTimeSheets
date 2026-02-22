# Timesheet Staging Deployment Pack

Product: **Timesheet**  
Subtitle: **for Alamo Projects**  
Mandatory footer on all UI/PDF: **Innoweb Ventures Limited**

Deterministic + auditable baseline:
- immutable workflow transitions
- effective-dated rules and pinned snapshots
- field-level audit trail with append-only guards
- export reproducibility with batch lineage

## 1) Monorepo Structure + Configs

```txt
/Users/mauriciojardim/AlamoProjectsTimeSheets
├── apps/
│   ├── api/
│   └── web/
├── packages/
│   └── shared/
├── db/
│   ├── migrations/
│   └── seeds/
├── infra/
│   ├── docker/
│   ├── env/
│   ├── proxy/
│   └── docker-compose.staging.yml
├── docs/
├── package.json
├── tsconfig.base.json
└── turbo.json
```

Key configs:
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/package.json`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/tsconfig.base.json`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/apps/api/package.json`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/apps/web/package.json`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/packages/shared/src/constants/branding.ts`

Branding constants (copy/paste):

```ts
export const BRANDING = {
  product: "Timesheet",
  subtitle: "for Alamo Projects",
  footer: "Innoweb Ventures Limited"
} as const;
```

## 2) DB Migrations + Seed Data

Migration order:
1. `/Users/mauriciojardim/AlamoProjectsTimeSheets/db/migrations/001_init_timesheet_schema.sql`
2. `/Users/mauriciojardim/AlamoProjectsTimeSheets/db/migrations/002_guards_and_triggers.sql`
3. `/Users/mauriciojardim/AlamoProjectsTimeSheets/db/migrations/003_auth_rbac.sql`
4. `/Users/mauriciojardim/AlamoProjectsTimeSheets/db/migrations/004_effective_dating_constraints.sql`
5. `/Users/mauriciojardim/AlamoProjectsTimeSheets/db/migrations/005_idempotency_keys.sql`
6. `/Users/mauriciojardim/AlamoProjectsTimeSheets/db/migrations/006_seed_registry.sql`
7. `/Users/mauriciojardim/AlamoProjectsTimeSheets/db/migrations/007_reporting_views.sql`

Seed order (idempotent):
1. `/Users/mauriciojardim/AlamoProjectsTimeSheets/db/seeds/001_seed_roles_and_admin.sql`
2. `/Users/mauriciojardim/AlamoProjectsTimeSheets/db/seeds/002_seed_leave_codes.sql`
3. `/Users/mauriciojardim/AlamoProjectsTimeSheets/db/seeds/003_seed_paid_hours_and_calendar_rules.sql`
4. `/Users/mauriciojardim/AlamoProjectsTimeSheets/db/seeds/004_seed_public_holidays.sql`
5. `/Users/mauriciojardim/AlamoProjectsTimeSheets/db/seeds/005_seed_sample_period.sql`
6. `/Users/mauriciojardim/AlamoProjectsTimeSheets/db/seeds/006_seed_sample_employees_policy_assignments.sql`

Execution commands:

```bash
npm run db:migrate --workspace @timesheet/api
npm run db:seed --workspace @timesheet/api
```

## 3) Calculation Engine Pseudocode + Test Vectors

Source:
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-calculation-engine-design.md`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/apps/api/src/services/rules-engine.service.ts`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/packages/shared/src/calculation/engine-design.ts`

Pseudocode (copy/paste):

```text
function evaluateDayEntry(input):
  ctx = resolveSnapshot(input.employee, input.workDate)
  normalized = normalize(input)
  mode = determineMode(normalized)

  validateStructural(mode, normalized)
  validateCalendar(mode, normalized, ctx.dayType)

  if mode == CODE_MODE:
    return leaveMinutes(defaultPaidByCode)

  if mode == TIME_MODE:
    worked = roundedMinutes(diff(start, finish) - break)
    split = splitByDayType(worked, ctx)
    requireManagerApprovalForOtOrPhWorked(split)
    return split

  return missingDayException
```

Test vectors (copy/paste):

```txt
TV-01 WORKDAY 08:00-16:30 break30 => normal 480, ot 0, ph_worked 0, leave 0
TV-02 WORKDAY 08:00-18:00 break30 => normal 480, ot 90, approval exception if unconfirmed
TV-03 AL leave code no time => leave 480
TV-04 AL + time => CODE_TIME_CONFLICT (blocking)
TV-05 PH not worked + PH code => leave 480
TV-06 PH not worked no PH code => PH_CODE_REQUIRED (blocking)
TV-07 PH worked 09:00-17:00 break30 => ph_worked 450, manager approval required
TV-08 Friday short day worked 7.5h => normal 360, ot 90
TV-09 Early knock-off paid full day => normal 480 (configurable)
TV-10 Weekly top-up => weekly ot applied deterministically
```

## 4) Locking/Revision/Unlock Implementation Spec

Source:
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-locking-revision-model.md`

Core rules:
- In-place edits allowed only in `DRAFT` and `MANAGER_REJECTED`.
- `MANAGER_APPROVED`, `PAYROLL_VALIDATED`, `LOCKED` require controlled revision.
- Unlock requires reason and creates new revision cycle.

State transitions (copy/paste):

```txt
DRAFT -> SUBMITTED -> MANAGER_APPROVED|MANAGER_REJECTED
MANAGER_APPROVED -> PAYROLL_VALIDATED -> LOCKED
LOCKED --(unlock reason)-> IN_REVISION (period)
IN_REVISION -> new timesheet revision DRAFT -> ... -> LOCKED
```

API endpoints (copy/paste):

```txt
POST /v1/payroll/periods/{periodId}/unlock
POST /v1/timesheets/{timesheetId}/revisions
POST /v1/payroll/periods/{periodId}/relock
GET  /v1/timesheets/{timesheetId}/revisions
```

## 5) Exception Framework

Source:
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-exception-framework.md`

Taxonomy (deterministic):
- missing entry
- missing approval
- PH mismatch
- overtime without approval
- abnormal totals
- rule conflicts

Minimum exception model (copy/paste):

```txt
code, severity(ERROR|WARNING), blocking, source_stage,
field_path, message, is_resolved, override_status,
override_by, override_reason_code, override_reason_text
```

Primary APIs:

```txt
GET  /v1/payroll/periods/{period_id}/exceptions
POST /v1/payroll/timesheets/{timesheet_id}/exceptions/recompute
POST /v1/payroll/exceptions/{exception_id}/resolve
POST /v1/payroll/exceptions/{exception_id}/override/request
POST /v1/payroll/exceptions/{exception_id}/override/approve
POST /v1/payroll/exceptions/{exception_id}/override/reject
POST /v1/payroll/exceptions/{exception_id}/reopen
```

## 6) Docker Deployment for Staging

Key files:
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/infra/docker-compose.staging.yml`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/infra/docker/api.Dockerfile`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/infra/docker/web.Dockerfile`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/infra/proxy/Caddyfile.staging`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/infra/env/.env.staging.example`

Run commands (copy/paste):

```bash
cd /Users/mauriciojardim/AlamoProjectsTimeSheets
cp infra/env/.env.staging.example infra/env/.env.staging
npm install
docker compose -f infra/docker-compose.staging.yml --env-file infra/env/.env.staging up -d --build
docker compose -f infra/docker-compose.staging.yml --env-file infra/env/.env.staging run --rm api-migrate
docker compose -f infra/docker-compose.staging.yml --env-file infra/env/.env.staging run --rm api-seed
open http://localhost
```

## 7) Security + Observability Checklists

Security pack:
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-security-rbac-pack.md`

Observability pack:
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-observability-design.md`

Must-pass controls:
1. Password + JWT policy enforced
2. Rate limits on auth and workflow mutation endpoints
3. RBAC endpoint matrix validated
4. Audit tables append-only + event hash chain validated
5. Structured logs include request id, user id, role, action
6. Alerts for elevated error rate, failed exports, unlock spikes

## 8) Pilot Rollout + Go/No-Go Gates

Pilot plan:
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-pilot-rollout-plan.md`

Go/No-Go pack:
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-go-no-go-launch-gate-pack.md`

Release gate minimums (copy/paste):

```txt
UAT pass >= 95% with 0 critical defects
Payroll export sign-off complete
Backup + restore dry run passed
RBAC/security verification passed
P95 API latency under agreed threshold
Rollback tested and documented
```

## 9) Single-Run Staging Bootstrap Script

```bash
cd /Users/mauriciojardim/AlamoProjectsTimeSheets
cp infra/env/.env.staging.example infra/env/.env.staging
npm install
docker compose -f infra/docker-compose.staging.yml --env-file infra/env/.env.staging up -d --build
docker compose -f infra/docker-compose.staging.yml --env-file infra/env/.env.staging run --rm api-migrate
docker compose -f infra/docker-compose.staging.yml --env-file infra/env/.env.staging run --rm api-seed
curl -sSf http://localhost/healthz
```

Expected result:
- API healthy at `/healthz`
- Web reachable at `/`
- Seeded employees/roles/rules/period available
- Audit/event tables active and immutable
