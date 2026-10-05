#!/usr/bin/env bash
# Prints the resume packet of the Codex session to continue in Claude.
# ~/.claude/skills/codex-resume links here, so resolve the link to find the
# bridge in the threadkeeper repo.
set -euo pipefail
skill_dir="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
exec node "$skill_dir/../../agent-state-migrator-bridge/src/cli.js" resume "$@"
