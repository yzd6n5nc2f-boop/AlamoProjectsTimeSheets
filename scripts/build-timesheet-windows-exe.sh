#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-${ROOT_DIR}/dist-windows}"
PACKAGE_DIR="${OUTPUT_DIR}/Timesheet-windows"
PAYLOAD_DIR="${PACKAGE_DIR}/AlamoProjectsTimeSheets"
EXE_PATH="${PACKAGE_DIR}/Timesheet.exe"
ZIP_PATH="${OUTPUT_DIR}/Timesheet-windows.zip"

mkdir -p "${OUTPUT_DIR}"
rm -rf "${PACKAGE_DIR}"
mkdir -p "${PACKAGE_DIR}" "${PAYLOAD_DIR}"

rsync -a \
  --delete \
  --exclude ".git" \
  --exclude ".DS_Store" \
  --exclude "node_modules" \
  --exclude "dist" \
  --exclude "dist-macos" \
  --exclude "dist-windows" \
  --exclude "apps/api/dist" \
  --exclude "apps/web/dist" \
  --exclude "coverage" \
  "${ROOT_DIR}/" "${PAYLOAD_DIR}/"

npx --yes pkg "${ROOT_DIR}/packaging/windows/TimesheetLauncher.js" \
  --target node18-win-x64 \
  --output "${EXE_PATH}"

cat > "${PACKAGE_DIR}/README-Windows.txt" <<'EOF'
Timesheet Windows Bundle

How to run:
1) Open Timesheet.exe
2) The launcher will try Docker staging stack first.
3) If Docker is unavailable, it falls back to frontend-only mode at http://localhost:3000.

Requirements on the Windows machine:
- Node.js 20+
- npm
- Docker Desktop (optional but recommended for full stack)
EOF

rm -f "${ZIP_PATH}"
(
  cd "${OUTPUT_DIR}"
  zip -rq "$(basename "${ZIP_PATH}")" "$(basename "${PACKAGE_DIR}")"
)

echo "Built launcher: ${EXE_PATH}"
echo "Built bundle zip: ${ZIP_PATH}"
