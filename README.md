# Timesheet

Subtitle: **for Alamo Projects**

Footer standard for UI/PDF outputs: **Innoweb Ventures Limited**

## Monorepo Layout

- `apps/web`: React + TypeScript frontend
- `apps/api`: Node.js + TypeScript backend
- `packages/shared`: shared constants, schemas, and types
- `db/migrations`: Postgres schema migrations
- `db/seeds`: idempotent seed data
- `infra`: Docker compose, reverse proxy config, environment templates
- `docs`: PRD/spec packs/checklists

## Full Commands to Run Locally (Staging Stack)

```bash
cd /Users/mauriciojardim/AlamoProjectsTimeSheets
cp infra/env/.env.staging.example infra/env/.env.staging
npm install
npm run infra:up:staging
npm run infra:migrate:staging
npm run infra:seed:staging
open http://localhost
```

## Full Commands to Run Without Docker (Local Dev)

Terminal 1:

```bash
cd /Users/mauriciojardim/AlamoProjectsTimeSheets
npm install
cp infra/env/.env.staging.example .env
export $(grep -v '^#' .env | xargs)
npm run db:migrate --workspace @timesheet/api
npm run db:seed --workspace @timesheet/api
npm run dev --workspace @timesheet/api
```

Terminal 2:

```bash
cd /Users/mauriciojardim/AlamoProjectsTimeSheets
npm run dev --workspace @timesheet/web
```

## Docs Pack

- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-mvp-architecture.md`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-mvp-ux-spec.md`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-rest-api-contract.md`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-calculation-engine-design.md`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-locking-revision-model.md`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-exception-framework.md`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-docker-deployment-plan.md`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-security-rbac-pack.md`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-observability-design.md`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-pilot-rollout-plan.md`
- `/Users/mauriciojardim/AlamoProjectsTimeSheets/docs/timesheet-go-no-go-launch-gate-pack.md`
