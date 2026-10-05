#!/usr/bin/env bash
# One-off cleanup for threads imported from Codex rollouts the bridge now
# skips (extractSessionFromFile in agent-state-migrator-bridge/src/codex-enumerator.js):
#
# - delegated sub-sessions: another Codex agent opened them to hand off part of
#   its work. Nobody typed into them, so they came in titled
#   "<project> session <date>", and their work belongs to the delegating session.
# - Claude sessions Codex imported and nobody went on with in Codex: Codex
#   replays the transcript as "external-import-turn-N" turns, and the Claude
#   original is imported on its own, so each was a second copy of a Claude thread.
#
# The bridge no longer imports these, so the threads made from them would sit
# there unrefreshed forever.
#
# The keys come from the bridge itself (listSkippedSessionKeys): the session
# ids of the rollouts under ~/.codex/sessions it now skips, and the
# repeat-<hash> keys that existed only because of them. Ids are listed even for
# sessions that fold into a repeat key, since an older bridge stored each on its
# own. A thread is removed only when every source session on it is one of them
# and it has no handoff.
#
# Usage:
#   scripts/remove-skipped-codex-threads.sh           # preview only, changes nothing
#   scripts/remove-skipped-codex-threads.sh --apply   # delete, in one transaction
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
    for (const key of m.listSkippedSessionKeys(process.env.CODEX_SESSIONS)) console.log(key);
  });
')"

if [ -z "$IDS" ]; then
  echo "No skipped Codex sessions under $CODEX_SESSIONS. Nothing to do."
  exit 0
fi

# The keys end up inside SQL, so take nothing but the shape a session key has.
VALUES=""
while IFS= read -r id; do
  if ! [[ "$id" =~ ^[0-9A-Za-z-]+$ ]]; then
    echo "Refusing unexpected session key: $id" >&2
    exit 1
  fi
  VALUES="${VALUES:+$VALUES,}('$id')"
done <<< "$IDS"
echo "Skipped Codex session keys found: $(wc -l <<< "$IDS" | tr -d ' ')"

CANDIDATES="
create temporary table skipped (key text) on commit drop;
insert into skipped values $VALUES;
create temporary table doomed on commit drop as
select t.id
from threads t
where exists (select 1 from source_sessions s where s.thread_id = t.id)
  and not exists (
      select 1 from source_sessions s
      where s.thread_id = t.id
        and (s.provider <> 'CODEX' or s.provider_session_key not in (select key from skipped))
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
