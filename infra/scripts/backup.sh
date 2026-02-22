#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <compose-file> <env-file> <backup-dir>"
  echo "Example: $0 infra/docker-compose.prod.yml infra/env/.env.prod /var/backups/timesheet"
  exit 1
fi

COMPOSE_FILE="$1"
ENV_FILE="$2"
BACKUP_DIR="$3"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "${BACKUP_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Env file not found: ${ENV_FILE}"
  exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

DB_BACKUP_FILE="${BACKUP_DIR}/timesheet_${TIMESTAMP}.dump"
GLOBALS_FILE="${BACKUP_DIR}/timesheet_globals_${TIMESTAMP}.sql"
SHA_FILE="${BACKUP_DIR}/timesheet_${TIMESTAMP}.sha256"

echo "[backup] creating DB dump: ${DB_BACKUP_FILE}"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc > "${DB_BACKUP_FILE}"

echo "[backup] creating globals dump: ${GLOBALS_FILE}"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T postgres \
  pg_dumpall -U "${POSTGRES_USER}" --globals-only > "${GLOBALS_FILE}"

sha256sum "${DB_BACKUP_FILE}" "${GLOBALS_FILE}" > "${SHA_FILE}"
echo "[backup] checksum written: ${SHA_FILE}"
echo "[backup] done"
