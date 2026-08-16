#!/bin/sh
set -eu
cd /app

mkdir -p /app/public/uploads/avatars

case "${1:-web}" in
  web)
    if [ -n "${DATABASE_URL:-}" ]; then
      npx prisma migrate deploy || true
    fi
    exec node server.js
    ;;
  reminders)
    exec npx tsx /app/scripts/reminder-worker.ts
    ;;
  *)
    exec "$@"
    ;;
esac
