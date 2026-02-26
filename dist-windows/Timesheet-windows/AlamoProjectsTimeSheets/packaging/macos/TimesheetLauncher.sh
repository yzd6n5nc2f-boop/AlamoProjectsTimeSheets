#!/bin/bash
set -euo pipefail

PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

APP_CONTENTS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_DIR="${APP_CONTENTS_DIR}/Resources/AlamoProjectsTimeSheets"
LOG_DIR="${HOME}/Library/Logs/Timesheet"
LAUNCH_LOG="${LOG_DIR}/launcher.log"

mkdir -p "${LOG_DIR}"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "${LAUNCH_LOG}"
}

alert() {
  /usr/bin/osascript -e "display alert \"Timesheet\" message \"$1\" as critical" >/dev/null 2>&1 || true
}

notify() {
  /usr/bin/osascript -e "display notification \"$1\" with title \"Timesheet\"" >/dev/null 2>&1 || true
}

ensure_env_file() {
  if [ ! -f "${PROJECT_DIR}/infra/env/.env.staging" ]; then
    cp "${PROJECT_DIR}/infra/env/.env.staging.example" "${PROJECT_DIR}/infra/env/.env.staging"
    log "Created infra/env/.env.staging from example."
  fi
}

ensure_node_modules() {
  if [ ! -d "${PROJECT_DIR}/node_modules" ]; then
    log "Installing npm dependencies..."
    cd "${PROJECT_DIR}"
    npm install >> "${LAUNCH_LOG}" 2>&1
  fi
}

docker_bin() {
  if command -v docker >/dev/null 2>&1; then
    command -v docker
    return 0
  fi
  if [ -x "/Applications/Docker.app/Contents/Resources/bin/docker" ]; then
    echo "/Applications/Docker.app/Contents/Resources/bin/docker"
    return 0
  fi
  return 1
}

run_docker_stack() {
  local docker_cmd
  if ! docker_cmd="$(docker_bin)"; then
    log "Docker binary not found."
    return 1
  fi

  if ! "${docker_cmd}" version >> "${LAUNCH_LOG}" 2>&1; then
    log "Docker is installed but not available."
    return 1
  fi

  cd "${PROJECT_DIR}"
  log "Starting staging stack with Docker Compose."

  "${docker_cmd}" compose -f infra/docker-compose.staging.yml --env-file infra/env/.env.staging up -d --build >> "${LAUNCH_LOG}" 2>&1
  "${docker_cmd}" compose -f infra/docker-compose.staging.yml --env-file infra/env/.env.staging run --rm api-migrate >> "${LAUNCH_LOG}" 2>&1
  "${docker_cmd}" compose -f infra/docker-compose.staging.yml --env-file infra/env/.env.staging run --rm api-seed >> "${LAUNCH_LOG}" 2>&1

  open "http://localhost"
  notify "Staging stack started at http://localhost"
  log "Docker stack started successfully."
  return 0
}

run_frontend_only() {
  cd "${PROJECT_DIR}"
  log "Falling back to frontend-only mode."

  if ! lsof -iTCP:3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    nohup npm run dev --workspace @timesheet/web >> "${LOG_DIR}/web.log" 2>&1 &
    echo $! > "${LOG_DIR}/web.pid"
    sleep 2
  fi

  open "http://localhost:3000"
  alert "Docker is not available. Running frontend-only mode at http://localhost:3000"
}

main() {
  log "Launcher started."

  if [ ! -d "${PROJECT_DIR}" ]; then
    alert "App payload is missing. Rebuild the .app bundle."
    log "Project directory missing: ${PROJECT_DIR}"
    exit 1
  fi

  if ! command -v npm >/dev/null 2>&1; then
    alert "Node.js/npm not found. Install Node.js 20+ and reopen Timesheet."
    log "npm command not found."
    exit 1
  fi

  ensure_env_file
  ensure_node_modules

  if ! run_docker_stack; then
    run_frontend_only
  fi
}

main "$@"
