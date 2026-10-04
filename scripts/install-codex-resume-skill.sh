#!/usr/bin/env bash
# Links the codex-resume skill into ~/.claude/skills so /codex-resume works in
# every project. The link points at this checkout: keep it on a branch that has
# skills/codex-resume.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd -P)"
source_dir="$repo/skills/codex-resume"
target="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}/codex-resume"

if [ -e "$target" ] && [ ! -L "$target" ]; then
  echo "$target already exists and is not a link; leaving it alone" >&2
  exit 1
fi
mkdir -p "$(dirname "$target")"
ln -sfn "$source_dir" "$target"
echo "linked $target -> $source_dir"
