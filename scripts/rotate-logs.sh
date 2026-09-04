#!/usr/bin/env bash
# Rotate the LaunchAgent logs. Called from start.sh and start-web.sh on every
# boot, before the long-running processes take over stdout.
#
# Rotation only happens at boot, so a machine that stays up for weeks keeps
# appending to one file until it is next restarted. That is the tradeoff of
# hanging this off the start scripts rather than running a second launchd job.
set -euo pipefail

LOG_DIR="${THREADKEEPER_LOG_DIR:-$HOME/Library/Logs/threadkeeper}"
MAX_BYTES="${THREADKEEPER_LOG_MAX_BYTES:-10485760}" # 10 MiB
KEEP_ARCHIVES="${THREADKEEPER_LOG_KEEP:-5}"

log() {
  echo "[$(date '+%F %T')] rotate-logs: $*"
}

# These come from the environment, so a typo would otherwise surface as an
# arithmetic error halfway through rotating.
for setting in MAX_BYTES KEEP_ARCHIVES; do
  case "${!setting}" in
    '' | *[!0-9]*)
      log "$setting must be a non-negative integer, got '${!setting}'"
      exit 1
      ;;
  esac
done

[ -d "$LOG_DIR" ] || exit 0

size_of() {
  # macOS stat and GNU stat disagree on flags; try BSD first.
  stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null || echo 0
}

for logfile in "$LOG_DIR"/*.log; do
  [ -f "$logfile" ] || continue

  size=$(size_of "$logfile")
  [ "$size" -gt "$MAX_BYTES" ] || continue

  base="${logfile%.log}"
  archive="$base.$(date '+%Y%m%d-%H%M%S').log.gz"

  # launchd holds these files open in append mode, so the archive has to be a
  # copy and the original has to be truncated in place. Renaming would leave
  # launchd writing to the renamed inode, and deleting would silently discard
  # every later line until the agent restarts. A handful of lines written
  # between the copy and the truncate are lost; that is the accepted cost.
  if gzip -c "$logfile" > "$archive"; then
    : > "$logfile"
    log "rotated $(basename "$logfile") ($size bytes) -> $(basename "$archive")"
  else
    log "failed to archive $(basename "$logfile"), leaving it alone"
    rm -f "$archive"
    continue
  fi

  # Keep only the newest archives for this log.
  { ls -1t "$base".*.log.gz 2>/dev/null || true; } |
    tail -n "+$((KEEP_ARCHIVES + 1))" | while read -r stale; do
    rm -f "$stale"
    log "pruned $(basename "$stale")"
  done
done
