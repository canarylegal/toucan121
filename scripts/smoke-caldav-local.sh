#!/usr/bin/env bash
# Start ephemeral Radicale (Compose profile: caldav-smoke), create a calendar, run smoke.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose --profile caldav-smoke)
echo "==> Starting Radicale smoke server…"
"${COMPOSE[@]}" up -d caldav-smoke

echo "==> Waiting for Radicale…"
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:15232/" >/dev/null; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "FAIL: Radicale did not become ready on :15232"
    "${COMPOSE[@]}" logs --tail=40 caldav-smoke || true
    exit 1
  fi
  sleep 0.5
done

# Radicale (auth none): still send Basic username matching the collection owner
USER_PATH="toucan"
CAL_NAME="smoke"
BASE="http://127.0.0.1:15232"
CAL_URL="${BASE}/${USER_PATH}/${CAL_NAME}/"
AUTH=(-u "${USER_PATH}:smoke")

echo "==> Ensuring collection ${CAL_URL}"
curl -sf "${AUTH[@]}" -X MKCOL "${BASE}/${USER_PATH}/" >/dev/null 2>&1 || true
curl -sf "${AUTH[@]}" -X MKCOL "${CAL_URL}" \
  -H "Content-Type: application/xml; charset=utf-8" \
  --data '<?xml version="1.0" encoding="utf-8" ?>
<D:mkcol xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <D:resourcetype>
        <D:collection/>
        <C:calendar/>
      </D:resourcetype>
      <D:displayname>Toucan smoke</D:displayname>
    </D:prop>
  </D:set>
</D:mkcol>' >/dev/null 2>&1 || \
curl -sf "${AUTH[@]}" -X MKCOL "${CAL_URL}" >/dev/null 2>&1 || true

# Verify calendar is discoverable
if ! curl -sf "${AUTH[@]}" -X PROPFIND -H "Depth: 1" "${BASE}/${USER_PATH}/" | grep -q "${CAL_NAME}"; then
  echo "FAIL: calendar collection not visible after MKCOL"
  curl -sv "${AUTH[@]}" -X PROPFIND -H "Depth: 1" "${BASE}/${USER_PATH}/" 2>&1 | tail -40
  exit 1
fi

export CALDAV_SERVER_URL="${BASE}/"
export CALDAV_USERNAME="${USER_PATH}"
export CALDAV_PASSWORD="smoke"
export CALDAV_CALENDAR_URL="${CAL_URL}"
export CALDAV_CALENDAR_NAME="Toucan smoke"

echo "==> Running smoke-caldav.ts"
npx tsx scripts/smoke-caldav.ts
STATUS=$?

if [ "${SMOKE_KEEP_CALDAV:-}" = "1" ]; then
  echo "==> Leaving caldav-smoke running (SMOKE_KEEP_CALDAV=1)"
else
  echo "==> Stopping Radicale smoke server…"
  "${COMPOSE[@]}" stop caldav-smoke >/dev/null
fi

exit $STATUS
