#!/usr/bin/env bash
# One-off cleanup for threads imported before the bridge started folding
# repeated prompts (agent-state-migrator-bridge/src/repeat-collapser.js).
#
# An automated run -- a hook that fires `codex exec "Review this change..."`
# on every commit -- used to land as one thread per run. The bridge now folds
# those into a single thread, but the threads already imported stay until
# removed. This removes them; the next import recreates each group as one
# thread under its stable `repeat-...` key.
#
# A thread is removed only when ALL of these hold:
#   - at least MIN_REPEATS threads in the same project share its title
#   - every source session on it is a per-session import (source_type 'session')
#     and none is already a folded `repeat-...` session
#   - it has no handoff, i.e. nobody has started working from it
#
# Usage:
#   scripts/collapse-repeated-imports.sh           # preview only, changes nothing
#   scripts/collapse-repeated-imports.sh --apply   # delete, in one transaction
set -euo pipefail

MIN_REPEATS="${THREADKEEPER_MIN_REPEATS:-3}"
# Talks to the docker-compose database by default; override to point elsewhere.
PSQL="${THREADKEEPER_PSQL:-docker exec -i threadkeeper-postgres psql -U threadkeeper -d threadkeeper}"

case "${1:-}" in
  "") APPLY=0 ;;
  --apply) APPLY=1 ;;
  *) echo "usage: $0 [--apply]" >&2; exit 2 ;;
esac

if ! [[ "$MIN_REPEATS" =~ ^[0-9]+$ ]] || [ "$MIN_REPEATS" -lt 2 ]; then
  echo "THREADKEEPER_MIN_REPEATS must be an integer of at least 2, got '$MIN_REPEATS'" >&2
  exit 2
fi

CANDIDATES="
create temporary table doomed on commit drop as
with imported as (
    select t.id, t.project_key, t.title
    from threads t
    where exists (select 1 from source_sessions s where s.thread_id = t.id)
      and not exists (
          select 1 from source_sessions s
          where s.thread_id = t.id
            and (s.source_type is distinct from 'session' or s.provider_session_key like 'repeat-%')
      )
      and not exists (select 1 from handoffs h where h.thread_id = t.id)
      and not exists (
          select 1 from handoffs h
          join source_sessions s on s.id = h.source_session_id
          where s.thread_id = t.id
      )
),
repeated as (
    select project_key, title
    from imported
    group by project_key, title
    having count(*) >= $MIN_REPEATS
)
select i.id
from imported i
join repeated r on r.project_key = i.project_key and r.title = i.title;
"

SUMMARY="
select t.project_key, count(*) as threads, left(t.title, 70) as title
from threads t join doomed d on d.id = t.id
group by t.project_key, t.title
order by count(*) desc;
"

if [ "$APPLY" -eq 0 ]; then
  $PSQL -v ON_ERROR_STOP=1 <<SQL
begin;
$CANDIDATES
\echo 'Threads that --apply would remove (grouped):'
$SUMMARY
rollback;
SQL
  echo "Preview only; nothing was changed. Re-run with --apply to delete."
  exit 0
fi

$PSQL -v ON_ERROR_STOP=1 <<SQL
begin;
$CANDIDATES
\echo 'Removing:'
$SUMMARY
delete from notification_events where thread_id in (select id from doomed);
delete from thread_snapshots where thread_id in (select id from doomed);
delete from source_sessions where thread_id in (select id from doomed);
delete from threads where id in (select id from doomed);
commit;
SQL
echo "Done. The next import recreates each group as a single thread."
