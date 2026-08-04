#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[$(date '+%F %T')] $*"
}

WEB_URL="${THREADKEEPER_WEB_URL:-http://localhost:3000}"

# `open` is macOS only; fall back to xdg-open elsewhere.
open_url() {
  if command -v open >/dev/null 2>&1; then
    open "$1"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$1"
  else
    log "no opener found; the dashboard is at $1"
  fi
}

# Only wait for the web dashboard; the api can take much longer to come up on a
# cold boot (postgres warm-up), and we'd rather surface a transient API error in
# the UI than make the user wait 30+ minutes for the browser to open.
log "waiting for web ($WEB_URL) up to 5 minutes..."
for _ in $(seq 1 150); do
  if curl -sf -m 2 "$WEB_URL" >/dev/null 2>&1; then
    log "web ready, opening dashboard"
    open_url "$WEB_URL"
    exit 0
  fi
  sleep 2
done

log "timeout: web not ready after 5 minutes"
exit 1
