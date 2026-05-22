#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[$(date '+%F %T')] $*"
}

WEB_URL="http://localhost:3000"

# Only wait for the web dashboard; the api can take much longer to come up on a
# cold boot (postgres warm-up), and we'd rather surface a transient API error in
# the UI than make the user wait 30+ minutes for the browser to open.
log "waiting for web ($WEB_URL) up to 5 minutes..."
for _ in $(seq 1 150); do
  if curl -sf -m 2 "$WEB_URL" >/dev/null 2>&1; then
    log "web ready, opening dashboard"
    open "$WEB_URL"
    exit 0
  fi
  sleep 2
done

log "timeout: web not ready after 5 minutes"
exit 1
