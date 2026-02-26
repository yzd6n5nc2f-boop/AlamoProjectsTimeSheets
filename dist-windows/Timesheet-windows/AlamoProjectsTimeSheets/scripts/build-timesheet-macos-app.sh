#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-${ROOT_DIR}/dist-macos}"
APP_NAME="Timesheet"
APP_DIR="${OUTPUT_DIR}/${APP_NAME}.app"
CONTENTS_DIR="${APP_DIR}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"
PAYLOAD_DIR="${RESOURCES_DIR}/AlamoProjectsTimeSheets"

mkdir -p "${OUTPUT_DIR}"
rm -rf "${APP_DIR}"
mkdir -p "${MACOS_DIR}" "${RESOURCES_DIR}"

cp "${ROOT_DIR}/packaging/macos/Info.plist" "${CONTENTS_DIR}/Info.plist"
cp "${ROOT_DIR}/packaging/macos/TimesheetLauncher.sh" "${MACOS_DIR}/Timesheet"
chmod +x "${MACOS_DIR}/Timesheet"

rsync -a \
  --delete \
  --exclude ".git" \
  --exclude ".DS_Store" \
  --exclude "node_modules" \
  --exclude "dist" \
  --exclude "dist-macos" \
  --exclude "apps/api/dist" \
  --exclude "apps/web/dist" \
  --exclude "coverage" \
  "${ROOT_DIR}/" "${PAYLOAD_DIR}/"

ZIP_PATH="${OUTPUT_DIR}/${APP_NAME}.zip"
rm -f "${ZIP_PATH}"
ditto -c -k --sequesterRsrc --keepParent "${APP_DIR}" "${ZIP_PATH}"

echo "Built app: ${APP_DIR}"
echo "Built zip: ${ZIP_PATH}"
