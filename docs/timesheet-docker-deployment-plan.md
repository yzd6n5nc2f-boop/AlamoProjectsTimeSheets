# Timesheet Docker Deployment Plan

Product: **Timesheet**  
Subtitle: **for Alamo Projects**  
Footer requirement (UI/PDF): **Innoweb Ventures Limited**

## 1) Compose Templates Included

- Staging: `/Users/mauriciojardim/AlamoProjectsTimeSheets/infra/docker-compose.staging.yml`
- Production: `/Users/mauriciojardim/AlamoProjectsTimeSheets/infra/docker-compose.prod.yml`
- Reverse proxy HTTPS config:
  - `/Users/mauriciojardim/AlamoProjectsTimeSheets/infra/proxy/Caddyfile.staging`
  - `/Users/mauriciojardim/AlamoProjectsTimeSheets/infra/proxy/Caddyfile.prod`
- Env templates:
  - `/Users/mauriciojardim/AlamoProjectsTimeSheets/infra/env/.env.staging.example`
  - `/Users/mauriciojardim/AlamoProjectsTimeSheets/infra/env/.env.prod.example`
- Backup/restore scripts:
  - `/Users/mauriciojardim/AlamoProjectsTimeSheets/infra/scripts/backup.sh`
  - `/Users/mauriciojardim/AlamoProjectsTimeSheets/infra/scripts/restore.sh`

## 2) Architecture

- `postgres` (persistent volume)
- `api` (Node/TS container, `/healthz` required)
- `web` (React runtime container, `/healthz` required)
- `proxy` (Caddy, automatic HTTPS certificates)
- `api-migrate` profile service for migrations during deploy

## 3) Environment Variables Strategy

### Staging and production

- Copy templates and create real env files:
  - `infra/env/.env.staging`
  - `infra/env/.env.prod`
- Keep real env files out of git.
- Minimum required values:
  - image refs: `API_IMAGE`, `WEB_IMAGE`, `IMAGE_TAG`
  - DB creds: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`
  - auth secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
  - hosts/TLS: `WEB_HOST`, `API_HOST`, `ACME_EMAIL`

### Secrets management guidance

- Dev/staging: local env files with restricted access.
- Production: inject secrets from a secret manager or CI secret store.
- Rotate auth/database secrets periodically.
- Never print secrets in logs.

## 4) Health Checks and Migrations on Deploy

### Health checks

- Postgres: `pg_isready`
- API: `GET /healthz`
- Web: `GET /healthz`

### Migrations on deploy

Use `api-migrate` profile service before app rollout:

```bash
docker compose --env-file infra/env/.env.staging -f infra/docker-compose.staging.yml --profile migrate run --rm api-migrate
docker compose --env-file infra/env/.env.prod -f infra/docker-compose.prod.yml --profile migrate run --rm api-migrate
```

Migrations must be backward-compatible for low downtime.

## 5) Run Commands

### 5.1 Staging first deploy

```bash
cp infra/env/.env.staging.example infra/env/.env.staging
# edit infra/env/.env.staging

docker compose --env-file infra/env/.env.staging -f infra/docker-compose.staging.yml pull
docker compose --env-file infra/env/.env.staging -f infra/docker-compose.staging.yml up -d postgres
docker compose --env-file infra/env/.env.staging -f infra/docker-compose.staging.yml --profile migrate run --rm api-migrate
docker compose --env-file infra/env/.env.staging -f infra/docker-compose.staging.yml up -d api web proxy
docker compose --env-file infra/env/.env.staging -f infra/docker-compose.staging.yml ps
```

### 5.2 Production deploy

```bash
cp infra/env/.env.prod.example infra/env/.env.prod
# edit infra/env/.env.prod with production values

docker compose --env-file infra/env/.env.prod -f infra/docker-compose.prod.yml pull
docker compose --env-file infra/env/.env.prod -f infra/docker-compose.prod.yml up -d postgres
docker compose --env-file infra/env/.env.prod -f infra/docker-compose.prod.yml --profile migrate run --rm api-migrate
docker compose --env-file infra/env/.env.prod -f infra/docker-compose.prod.yml up -d api web proxy
docker compose --env-file infra/env/.env.prod -f infra/docker-compose.prod.yml ps
```

### 5.3 Rolling app update (same compose stack)

```bash
# update API and Web to new IMAGE_TAG in env file
docker compose --env-file infra/env/.env.prod -f infra/docker-compose.prod.yml pull api web
docker compose --env-file infra/env/.env.prod -f infra/docker-compose.prod.yml --profile migrate run --rm api-migrate
docker compose --env-file infra/env/.env.prod -f infra/docker-compose.prod.yml up -d api web
```

### 5.4 Backups and restore

```bash
bash infra/scripts/backup.sh infra/docker-compose.prod.yml infra/env/.env.prod /var/backups/timesheet
bash infra/scripts/restore.sh infra/docker-compose.prod.yml infra/env/.env.prod /var/backups/timesheet/timesheet_YYYYMMDDTHHMMSSZ.dump /var/backups/timesheet/timesheet_globals_YYYYMMDDTHHMMSSZ.sql
```

## 6) Backup Strategy + Restore Procedure

### Backup strategy

1. Nightly logical backup (`pg_dump -Fc`) of Timesheet DB.
2. Nightly globals backup (`pg_dumpall --globals-only`) for roles/grants.
3. Store checksums for backup files.
4. Retention policy:
  - daily backups: 14 days
  - weekly backups: 8 weeks
  - monthly backups: 12 months
5. Replicate encrypted backups to off-host/off-region storage.
6. Run restore drill at least monthly on non-production environment.

### Restore procedure (summary)

1. Ensure target stack is up (`postgres` healthy).
2. Confirm maintenance window and stop write traffic.
3. Run `restore.sh` with chosen dump + globals files.
4. Re-run migrations if needed.
5. Validate row counts/checksum and smoke test critical endpoints.
6. Re-enable traffic.

## 7) Zero/Low Downtime Deploy Notes

### Practical with docker compose

- True zero downtime is best with orchestrators (Kubernetes/Nomad/Swarm).
- With compose, use low-downtime strategy:
  1. Backward-compatible migrations first.
  2. Keep proxy running while restarting app services.
  3. Deploy API first, then Web.
  4. Avoid destructive schema changes in same release.

### Recommended migration policy (expand/contract)

1. Expand:
  - add nullable columns/new tables/indexes.
2. Deploy application using new schema.
3. Backfill data if required.
4. Contract:
  - remove old columns only in later release.

## 8) Release Checklist

### Pre-release

- [ ] Image tags immutable and pushed (`API_IMAGE`, `WEB_IMAGE`, `IMAGE_TAG`).
- [ ] Env files updated for target environment.
- [ ] Secrets rotated/verified in secret store.
- [ ] Migrations reviewed for backward compatibility.
- [ ] Backup completed and checksum verified.
- [ ] Rollback plan prepared (previous image tag + restore point).

### Deploy

- [ ] `docker compose pull` successful.
- [ ] Database healthy.
- [ ] Migrations run successfully (`api-migrate`).
- [ ] `api`, `web`, `proxy` updated and healthy.
- [ ] HTTPS certificate issuance valid.

### Post-deploy verification

- [ ] `/healthz` for API and Web returns OK.
- [ ] Login and role-based routes function.
- [ ] Timesheet save/submit flow works.
- [ ] Manager approval and payroll validation flow works.
- [ ] Export batch generation/download works.
- [ ] Footer text visible across UI and generated PDFs: `Innoweb Ventures Limited`.
- [ ] Audit trail records new deployment actions as expected.

