#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/Users/jean325/portfolio/projects/threadkeeper"
cd "$PROJECT_DIR/threadkeeper-web"

log() {
  echo "[$(date '+%F %T')] $*"
}

# Trim the logs before this run starts appending to them.
"$PROJECT_DIR/scripts/rotate-logs.sh" || log "log rotation failed, continuing"

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

log "node: $(command -v node || echo none)"
log "starting next dev..."
exec npm run dev
