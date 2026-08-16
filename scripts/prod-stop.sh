#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

stop_pidfile() {
  local file="$1"
  local name="$2"
  if [ -f "$file" ]; then
    local pid
    pid="$(cat "$file")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping ${name} (pid ${pid})…"
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$file"
  fi
}

stop_pidfile .run/web.pid web
stop_pidfile .run/reminders.pid reminders

# Also clear stray next start / reminder worker from this repo if pidfiles were lost
pkill -f "${ROOT}/node_modules/next/dist/bin/next start" 2>/dev/null || true
pkill -f "${ROOT}/scripts/reminder-worker.ts" 2>/dev/null || true

echo "Stopped."
