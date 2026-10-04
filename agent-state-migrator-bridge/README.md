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

## Resuming a Codex session in Claude

When a Codex turn stops partway (usually the usage limit), `resume` prints a
markdown packet of where it stopped, for Claude to pick up:

```bash
node src/cli.js resume --cwd /path/to/project      # latest session that ran there
node src/cli.js resume --session 01a0e2b5           # or by part of its id
```

It picks the latest rollout (by mtime) that ran in `--cwd` (default: the current
folder), treating a `.claude/worktrees/<name>` folder as its project and skipping
sessions another agent spawned. The packet has the stop reason and, for the usage
limit, when it resets; the first prompt; the last two finished turns; and, for
the last turn, the request (without the context Codex wraps around it), Codex's
progress notes, the files it patched, its last commands with exit codes, and its
reasoning headings. `--json` prints the packet object instead. With no session
to pick it exits 2 and lists the recent ones on stderr.

`--codex-home` is the sessions root, as for import; thread names come from
`session_index.jsonl` beside it.

The `/codex-resume` Claude skill in [`skills/codex-resume`](../skills/codex-resume)
runs this and has Claude check the packet against `git status` before carrying
on. `scripts/install-codex-resume-skill.sh` links it into `~/.claude/skills`.
