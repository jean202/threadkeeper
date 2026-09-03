#!/usr/bin/env bash
set -euo pipefail

# Derive the repo root from this script's own location so the script works from
# any checkout. THREADKEEPER_DIR still overrides it if you keep the code
# somewhere else.
PROJECT_DIR="${THREADKEEPER_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$PROJECT_DIR/threadkeeper-web"

log() {
  echo "[$(date '+%F %T')] $*"
}

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

log "node: $(command -v node || echo none)"
log "starting next dev..."
exec npm run dev
