#!/usr/bin/env bash
# Build and run Toucan 121 in production mode (next start) + reminder worker.
# Tunnel / reverse proxy should point at APP_PORT (default 3000).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_PORT="${PORT:-3000}"
export NODE_ENV=production

if [ ! -f .env ]; then
  echo "FAIL: .env missing — copy .env.example and fill secrets"
  exit 1
fi

# Load .env for this shell (without exporting comments)
set -a
# shellcheck disable=SC1091
source .env
set +a

# Prefer public URL; force common for multi-tenant Outlook
: "${APP_URL:=http://localhost:3000}"
: "${MICROSOFT_TENANT_ID:=common}"
export APP_URL MICROSOFT_TENANT_ID

echo "==> prisma generate + migrate deploy"
npm run db:generate
npm run db:deploy

echo "==> next build"
npm run build

mkdir -p .run/logs

echo "==> starting next start on :${APP_PORT}"
nohup npx next start -p "${APP_PORT}" >.run/logs/web.log 2>&1 &
echo $! >.run/web.pid
echo "    pid $(cat .run/web.pid)  log .run/logs/web.log"

echo "==> starting reminder worker"
nohup npm run reminders:worker >.run/logs/reminders.log 2>&1 &
echo $! >.run/reminders.pid
echo "    pid $(cat .run/reminders.pid)  log .run/logs/reminders.log"

echo
echo "OK — production processes started."
echo "  APP_URL=${APP_URL}"
echo "  Stop with: scripts/prod-stop.sh"
echo "  Or systemd: see deploy/systemd/"
