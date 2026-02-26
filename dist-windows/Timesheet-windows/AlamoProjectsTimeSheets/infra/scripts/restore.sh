#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 4 ]]; then
  echo "Usage: $0 <compose-file> <env-file> <dump-file> <globals-file>"
  echo "Example: $0 infra/docker-compose.prod.yml infra/env/.env.prod /backups/timesheet_20260222T120000Z.dump /backups/timesheet_globals_20260222T120000Z.sql"
  exit 1
fi

COMPOSE_FILE="$1"
ENV_FILE="$2"
DUMP_FILE="$3"
GLOBALS_FILE="$4"

if [[ ! -f "${DUMP_FILE}" ]]; then
  echo "Dump file not found: ${DUMP_FILE}"
  exit 1
fi

if [[ ! -f "${GLOBALS_FILE}" ]]; then
  echo "Globals file not found: ${GLOBALS_FILE}"
  exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

echo "WARNING: this will replace database '${POSTGRES_DB}'."
read -r -p "Type 'RESTORE' to continue: " CONFIRM
if [[ "${CONFIRM}" != "RESTORE" ]]; then
  echo "Restore cancelled."
  exit 1
fi

echo "[restore] restoring globals"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T postgres \
  psql -U "${POSTGRES_USER}" -d postgres < "${GLOBALS_FILE}"

echo "[restore] recreating database ${POSTGRES_DB}"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T postgres \
  psql -U "${POSTGRES_USER}" -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${POSTGRES_DB}' AND pid <> pg_backend_pid();"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T postgres \
  dropdb -U "${POSTGRES_USER}" --if-exists "${POSTGRES_DB}"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T postgres \
  createdb -U "${POSTGRES_USER}" "${POSTGRES_DB}"

echo "[restore] restoring dump ${DUMP_FILE}"
cat "${DUMP_FILE}" | docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T postgres \
  pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists --no-owner --no-privileges

echo "[restore] done"
