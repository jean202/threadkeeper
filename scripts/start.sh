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

# Trim the logs before this run starts appending to them.
"$PROJECT_DIR/scripts/rotate-logs.sh" || log "log rotation failed, continuing"

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

# Container healthcheck passing doesn't guarantee the host-side port mapping
# is ready yet -- on a cold boot Docker Desktop's vpnkit can take an extra
# 30-60s to finish wiring localhost:5432. Probe from the host to be sure.
log "probing host-side localhost:5432 (up to 120s)..."
for _ in $(seq 1 60); do
  if (echo >/dev/tcp/127.0.0.1/5432) 2>/dev/null; then
    log "postgres reachable from host"
    break
  fi
  sleep 2
done

if ! (echo >/dev/tcp/127.0.0.1/5432) 2>/dev/null; then
  log "postgres still not reachable from host, aborting (LaunchAgent will retry)"
  exit 1
fi

log "starting threadkeeper-api..."
cd threadkeeper-api
exec ./gradlew --no-daemon bootRun
