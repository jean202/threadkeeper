#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[$(date '+%F %T')] $*"
}

API_URL="http://localhost:8080/actuator/health"
WEB_URL="http://localhost:3000"

log "waiting for api ($API_URL) and web ($WEB_URL) up to 5 minutes..."
for _ in $(seq 1 150); do
  if curl -sf -m 2 "$API_URL" >/dev/null 2>&1 && curl -sf -m 2 "$WEB_URL" >/dev/null 2>&1; then
    log "both ready, opening dashboard"
    open "$WEB_URL"
    exit 0
  fi
  sleep 2
done

log "timeout: at least one service not ready after 5 minutes"
exit 1
