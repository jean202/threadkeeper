#!/usr/bin/env bash
# One-off cleanup for threads imported from Codex sub-sessions before the
# bridge started leaving them out (isDelegatedSubSession in
# agent-state-migrator-bridge/src/codex-enumerator.js).
#
# A sub-session is one another Codex agent opened to hand off part of its
# work: nobody typed into it, so it came in titled "<project> session <date>",
# and the work it did already belongs to the session that delegated it. The
# bridge no longer imports these, so the threads made from them would sit
# there unrefreshed forever.
#
# The session ids come from the bridge's own check run over ~/.codex/sessions,
# so this removes exactly the sessions the import now skips. A thread is
# removed only when every source session on it is one of them and it has no
# handoff.
#
# Usage:
#   scripts/remove-delegated-codex-threads.sh           # preview only, changes nothing
#   scripts/remove-delegated-codex-threads.sh --apply   # delete, in one transaction
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODEX_SESSIONS="${THREADKEEPER_CODEX_SESSIONS:-$HOME/.codex/sessions}"
PSQL="${THREADKEEPER_PSQL:-docker exec -i threadkeeper-postgres psql -U threadkeeper -d threadkeeper}"

case "${1:-}" in
  "") APPLY=0 ;;
  --apply) APPLY=1 ;;
  *) echo "usage: $0 [--apply]" >&2; exit 2 ;;
esac

IDS="$(cd "$PROJECT_DIR/agent-state-migrator-bridge" && CODEX_SESSIONS="$CODEX_SESSIONS" node -e '
  import("./src/codex-enumerator.js").then((m) => {
    for (const id of m.listDelegatedSubSessionIds(process.env.CODEX_SESSIONS)) console.log(id);
  });
')"

if [ -z "$IDS" ]; then
  echo "No delegated Codex sub-sessions under $CODEX_SESSIONS. Nothing to do."
  exit 0
fi

# The ids end up inside SQL, so take nothing but the shape a session id has.
VALUES=""
while IFS= read -r id; do
  if ! [[ "$id" =~ ^[0-9A-Za-z-]+$ ]]; then
    echo "Refusing unexpected session id: $id" >&2
    exit 1
  fi
  VALUES="${VALUES:+$VALUES,}('$id')"
done <<< "$IDS"
echo "Delegated sub-sessions found: $(wc -l <<< "$IDS" | tr -d ' ')"

CANDIDATES="
create temporary table delegated (key text) on commit drop;
insert into delegated values $VALUES;
create temporary table doomed on commit drop as
select t.id
from threads t
where exists (select 1 from source_sessions s where s.thread_id = t.id)
  and not exists (
      select 1 from source_sessions s
      where s.thread_id = t.id
        and (s.provider <> 'CODEX' or s.provider_session_key not in (select key from delegated))
  )
  and not exists (select 1 from handoffs h where h.thread_id = t.id)
  and not exists (
      select 1 from handoffs h
      join source_sessions s on s.id = h.source_session_id
      where s.thread_id = t.id
  );
"

SUMMARY="
select t.id, t.project_key, left(t.title, 60) as title
from threads t join doomed d on d.id = t.id
order by t.id;
"

if [ "$APPLY" -eq 0 ]; then
  $PSQL -v ON_ERROR_STOP=1 <<SQL
begin;
$CANDIDATES
\echo 'Threads that --apply would remove:'
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
echo "Done."
