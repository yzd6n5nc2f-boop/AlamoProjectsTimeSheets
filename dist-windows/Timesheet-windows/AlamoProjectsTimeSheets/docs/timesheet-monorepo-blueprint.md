# Timesheet Production Monorepo Blueprint

Product: **Timesheet**  
Subtitle: **for Alamo Projects**  
Mandatory footer on all UI/PDF outputs: **Innoweb Ventures Limited**

## 1) Directory Tree

```txt
.
├── apps/
│   ├── web/                         # React + TypeScript
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── features/
│   │   │   ├── components/
│   │   │   ├── routes/
│   │   │   ├── lib/
│   │   │   ├── styles/
│   │   │   └── main.tsx
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   └── api/                         # Node + TypeScript
│       ├── src/
│       │   ├── controllers/
│       │   ├── routes/
│       │   ├── middleware/
│       │   ├── services/
│       │   ├── repositories/
│       │   ├── jobs/
│       │   ├── config/
│       │   ├── db/
│       │   │   └── migrations/
│       │   ├── shared/
│       │   ├── app.ts
│       │   └── server.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── shared/                      # cross-app shared contracts
│       ├── src/
│       │   ├── types/
│       │   ├── schemas/             # zod validation schemas
│       │   ├── constants/
│       │   │   └── branding.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── infra/
│   ├── docker-compose.yml
│   ├── docker/
│   │   ├── api.Dockerfile
│   │   └── web.Dockerfile
│   ├── env/
│   │   ├── .env.common.example
│   │   ├── .env.web.example
│   │   ├── .env.api.example
│   │   └── .env.db.example
│   └── scripts/
│       ├── bootstrap.sh
│       ├── migrate.sh
│       └── seed.sh
├── docs/
│   ├── PRD.md
│   ├── API.md
│   ├── ADR/
│   │   ├── 0001-monorepo-tooling.md
│   │   └── 0002-auth-rbac.md
│   └── runbooks/
│       ├── local-setup.md
│       ├── deployment.md
│       ├── rollback.md
│       └── incident-response.md
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── release.yml
│       └── db-migrate.yml
├── .editorconfig
├── .gitignore
├── .npmrc
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── eslint.config.mjs
├── prettier.config.cjs
├── commitlint.config.cjs
└── README.md
```

## 2) Key Config Files List

| File | Purpose |
|---|---|
| `package.json` (root) | Workspace scripts, orchestration commands (`dev`, `build`, `test`, `lint`). |
| `pnpm-workspace.yaml` | Monorepo package boundaries (`apps/*`, `packages/*`). |
| `turbo.json` | Task graph, cache strategy, pipeline dependencies. |
| `tsconfig.base.json` | Shared strict TypeScript compiler options. |
| `eslint.config.mjs` | Shared lint rules for TS/React/Node. |
| `prettier.config.cjs` | Formatting standards (line width, quotes, trailing commas). |
| `commitlint.config.cjs` | Conventional commit enforcement. |
| `.github/workflows/ci.yml` | Build/test/lint/typecheck security and migration checks. |
| `apps/web/package.json` | Web app scripts and dependencies. |
| `apps/web/vite.config.ts` | Frontend bundling/dev server config. |
| `apps/api/package.json` | API app scripts and dependencies. |
| `apps/api/src/config/env.ts` | Runtime environment variable parsing/validation (zod). |
| `apps/api/src/middleware/rbac.middleware.ts` | RBAC enforcement by route/role. |
| `apps/api/src/middleware/auditLog.middleware.ts` | Field-level audit event capture hooks. |
| `packages/shared/src/schemas/*` | Shared request/response/domain validation schemas. |
| `packages/shared/src/constants/branding.ts` | Brand name/subtitle/footer constants used by web and PDF generation. |
| `infra/docker-compose.yml` | Local stack: web, api, postgres, redis (optional). |
| `infra/env/*.example` | Non-secret env templates for each app and common config. |

## 3) Naming Conventions

### General

- Folders/files: `kebab-case` (except React component files in `PascalCase`).
- TS symbols:
  - interfaces/types: `PascalCase`
  - functions/variables: `camelCase`
  - constants/env keys: `UPPER_SNAKE_CASE`
- DB names: `snake_case` tables/columns.

### Backend suffix conventions

- Controllers: `*.controller.ts`
- Services: `*.service.ts`
- Repositories: `*.repository.ts`
- Middlewares: `*.middleware.ts`
- Routes: `*.routes.ts`

### API naming

- REST paths use plural resources: `/timesheets`, `/periods`, `/export-batches`.
- Response envelopes standardized as `{ data, meta }`.
- Error codes standardized (`VALIDATION_ERROR`, `FORBIDDEN`, `ROW_VERSION_CONFLICT`).

## 4) Lint/Format Standards

- TypeScript strict mode enabled (`"strict": true`, no implicit any).
- ESLint shared rules:
  - no floating promises
  - no unused vars/imports
  - consistent type imports
  - React hooks rules
- Prettier as canonical formatter.
- Pre-commit checks:
  - `lint-staged` runs `eslint --fix` and `prettier --write` on staged files.
- CI blocking gates:
  - lint, typecheck, tests, build must pass before merge.

## 5) CI Pipeline Steps

### `ci.yml` (pull requests and main)

1. Checkout repo.
2. Setup Node + PNPM cache.
3. Install dependencies (`pnpm install --frozen-lockfile`).
4. Lint (`pnpm lint`).
5. Typecheck (`pnpm typecheck`).
6. Unit tests (`pnpm test:unit`).
7. Integration tests with Postgres service (`pnpm test:integration`).
8. Build all packages/apps (`pnpm build`).
9. Migration verification:
  - apply migrations on ephemeral DB
  - run schema smoke checks
10. Security checks:
  - dependency audit
  - secret scan

### `release.yml` (main/tag)

1. Build immutable artifacts/images.
2. Push container images.
3. Deploy to stage/prod.
4. Run health checks and smoke tests.

## 6) Environment Variable Strategy (dev/stage/prod)

### File strategy

- Committed templates only:
  - `infra/env/.env.common.example`
  - `infra/env/.env.web.example`
  - `infra/env/.env.api.example`
  - `infra/env/.env.db.example`
- Local real env files are ignored (`.env.local`, `.env`).

### Precedence

1. System environment variables
2. Environment-specific secrets (stage/prod secret manager injection)
3. `.env.common`
4. App-specific `.env.web` or `.env.api`
5. Local overrides for developers (`.env.local`)

### Required env key naming

- Prefix app-scoped variables:
  - API: `API_*` (e.g., `API_PORT`, `API_JWT_SECRET`)
  - Web runtime public values: `WEB_PUBLIC_*`
  - DB: `DB_*`
- Validate all required envs at startup via zod and fail-fast.

## 7) Secrets Management Guidance

- Never commit secrets to repository or example env files.
- Use managed secret stores in stage/prod (e.g., AWS Secrets Manager, GCP Secret Manager, Vault).
- Rotate sensitive secrets on schedule:
  - JWT signing keys
  - DB passwords
  - SMTP/API credentials
- Principle of least privilege:
  - separate DB users per environment
  - read-only credentials for reporting jobs where possible
- Prevent leakage:
  - redact secrets in logs
  - disable verbose error bodies in production
- CI secrets:
  - use GitHub Encrypted Secrets or OIDC + cloud IAM short-lived creds.

## 8) Footer Requirement (UI/PDF)

Create shared branding constants in `packages/shared/src/constants/branding.ts`:

```ts
export const BRAND = {
  name: "Timesheet",
  subtitle: "for Alamo Projects",
  footerLegal: "Innoweb Ventures Limited"
} as const;
```

Implementation requirements:

1. Web app global layout footer renders `BRAND.footerLegal` on every page.
2. PDF generation service in API always injects same footer in document template.
3. Add automated checks:
  - UI integration test asserts footer presence on all route shells.
  - PDF snapshot test asserts footer text exists.

## 9) Local Run Scripts

### Root `package.json` scripts (recommended)

```json
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "dev:web": "pnpm --filter @timesheet/web dev",
    "dev:api": "pnpm --filter @timesheet/api dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "test:unit": "turbo run test:unit",
    "test:integration": "turbo run test:integration",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "format": "prettier --write .",
    "infra:up": "docker compose -f infra/docker-compose.yml up -d",
    "infra:down": "docker compose -f infra/docker-compose.yml down",
    "db:migrate": "pnpm --filter @timesheet/api db:migrate",
    "db:seed": "pnpm --filter @timesheet/api db:seed"
  }
}
```

### Local startup sequence

1. `pnpm install`
2. `pnpm infra:up`
3. Copy env templates to local env files and fill values.
4. `pnpm db:migrate`
5. `pnpm db:seed`
6. `pnpm dev`

---

This blueprint is intended as the production baseline for Timesheet monorepo setup and implementation.

