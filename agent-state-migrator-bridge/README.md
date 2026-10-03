# Agent State Migrator Bridge

This module bridges `agent-state-migrator` and ThreadKeeper.

Its responsibilities are:

- invoke `agent-state-migrator inspect`
- parse provider artifacts
- normalize results into ThreadKeeper import payloads

Planned entry points:

- `inspectProviders()`
- `importSourceSessions()`
- `mapArtifactsToCanonicalEvents()`

## Where sessions come from

| Target | Read from | One thread per |
| --- | --- | --- |
| `codex` | `~/.codex/sessions/**/rollout-*.jsonl` (`--codex-home`) | session |
| `claude` | `~/.claude/projects/*/<session-id>.jsonl` (`--claude-home`) | session |
| anything else | `agent-state-migrator inspect` (`--migrator-path`) | artifact group |

Codex and Claude transcripts are read directly, so neither needs the migrator.
A session is titled by its `/rename` name if it has one, otherwise by the first
prompt the user typed; slash-command wrappers, tool results and other turns
Claude Code writes on the user's behalf are skipped. Its project key is the
basename of the session's working directory, with a `.claude/worktrees/<name>`
suffix stripped so worktree sessions join their main project.

## Repeated prompts

When three or more Codex or Claude sessions in the same project open with the
same prompt (compared on the 80-character title, since a templated prompt often
goes on to list changed files), they are folded into one source session keyed
`repeat-<hash>`. Each later run refreshes that one thread instead of adding a new
one; `metadata.repeatCount` records how many runs it stands for. This keeps an
automated hook — e.g. `codex exec "Review this change..."` on every commit —
from filling the thread list. `--min-repeats <n>` (at least 2) changes the
threshold.

Threads imported before this existed can be removed with
`scripts/collapse-repeated-imports.sh` (preview by default, `--apply` to delete).
