#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/Users/jean325/portfolio/projects/threadkeeper"
cd "$PROJECT_DIR"

log() {
  echo "[$(date '+%F %T')] $*"
}

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

log "waiting for docker daemon (up to 180s)..."
for _ in $(seq 1 90); do
  if docker info >/dev/null 2>&1; then
    log "docker ready"
    break
  fi
  sleep 2
done

if ! docker info >/dev/null 2>&1; then
  log "docker not available, aborting"
  exit 1
fi

log "starting postgres (waiting until healthy)..."
docker compose up -d --wait postgres

log "starting threadkeeper-api..."
cd threadkeeper-api
exec ./gradlew --no-daemon bootRun
