#!/usr/bin/env bash
# Tests for rotate-logs.sh. Plain bash, so it runs anywhere the script does.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROTATE="$SCRIPT_DIR/rotate-logs.sh"

passed=0
failed=0

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    passed=$((passed + 1))
    echo "  ok   $label"
  else
    failed=$((failed + 1))
    echo "  FAIL $label"
    echo "         expected: $expected"
    echo "         actual:   $actual"
  fi
}

size_of() {
  stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null || echo -1
}

new_log_dir() {
  local dir
  dir="$(mktemp -d)"
  echo "$dir"
}

# Writes a file of at least $2 bytes.
make_log() {
  local path="$1" bytes="$2"
  head -c "$bytes" /dev/zero | tr '\0' 'x' > "$path"
}

run_rotate() {
  THREADKEEPER_LOG_DIR="$1" \
  THREADKEEPER_LOG_MAX_BYTES="${2:-100}" \
  THREADKEEPER_LOG_KEEP="${3:-5}" \
    "$ROTATE" > /dev/null 2>&1
  echo $?
}

echo "a log under the limit is left alone"
dir="$(new_log_dir)"
make_log "$dir/api.log" 50
check "exit status" 0 "$(run_rotate "$dir" 100)"
check "still 50 bytes" 50 "$(size_of "$dir/api.log")"
check "no archive created" 0 "$(find "$dir" -name '*.log.gz' | wc -l | tr -d ' ')"
rm -rf "$dir"

echo "a log over the limit is archived and truncated"
dir="$(new_log_dir)"
make_log "$dir/api.log" 500
check "exit status" 0 "$(run_rotate "$dir" 100)"
check "truncated to zero" 0 "$(size_of "$dir/api.log")"
check "one archive created" 1 "$(find "$dir" -name 'api.*.log.gz' | wc -l | tr -d ' ')"
check "archive holds the original 500 bytes" 500 \
  "$(gzip -dc "$dir"/api.*.log.gz | wc -c | tr -d ' ')"
rm -rf "$dir"

# The point of copy-and-truncate: launchd holds the log open in append mode, so
# rotation must not swap the file out from under it. Comparing inodes looks like
# the way to check that, but it is not: the filesystem hands the freed inode
# number straight back, so a rename-then-recreate implementation reports the
# same inode and the assertion passes against broken code. Holding a descriptor
# open across the rotation and writing through it is what actually proves it.
echo "a still-open writer keeps writing to the same file"
dir="$(new_log_dir)"
make_log "$dir/api.log" 500
exec 9>>"$dir/api.log"
run_rotate "$dir" 100 > /dev/null
echo -n "after-rotation" >&9
exec 9>&-
check "post-rotation write landed in the live log" "after-rotation" "$(cat "$dir/api.log")"
rm -rf "$dir"

echo "only the newest archives are kept"
dir="$(new_log_dir)"
for i in 1 2 3 4 5 6 7; do
  touch -t "20260101000$i" "$dir/api.2026010100000$i.log.gz"
done
make_log "$dir/api.log" 500
run_rotate "$dir" 100 2 > /dev/null
check "kept exactly 2 archives" 2 "$(find "$dir" -name 'api.*.log.gz' | wc -l | tr -d ' ')"
rm -rf "$dir"

echo "unrelated files are not touched"
dir="$(new_log_dir)"
make_log "$dir/notes.txt" 500
make_log "$dir/api.log" 500
run_rotate "$dir" 100 > /dev/null
check "the .txt is untouched" 500 "$(size_of "$dir/notes.txt")"
check "the .log was rotated" 0 "$(size_of "$dir/api.log")"
rm -rf "$dir"

echo "a missing log directory is not an error"
check "exit status" 0 "$(run_rotate "/nonexistent/threadkeeper-logs" 100)"

echo "an empty log directory is not an error"
dir="$(new_log_dir)"
check "exit status" 0 "$(run_rotate "$dir" 100)"
rm -rf "$dir"

echo "a non-numeric setting fails loudly rather than midway through"
dir="$(new_log_dir)"
make_log "$dir/api.log" 500
status=$(THREADKEEPER_LOG_DIR="$dir" THREADKEEPER_LOG_MAX_BYTES=abc "$ROTATE" >/dev/null 2>&1; echo $?)
check "exit status is non-zero" 1 "$status"
check "the log was left alone" 500 "$(size_of "$dir/api.log")"
rm -rf "$dir"

echo
echo "passed: $passed  failed: $failed"
[ "$failed" -eq 0 ]
