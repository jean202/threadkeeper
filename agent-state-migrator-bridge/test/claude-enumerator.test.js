import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enumerateClaudeSessions, findClaudeSessionFiles } from "../src/claude-enumerator.js";
import { deriveProjectKey } from "../src/codex-enumerator.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "fixtures", "claude-projects");

function byKey(sessions, key) {
  return sessions.find((s) => s.providerSessionKey === key);
}

test("finds one transcript per session, skipping subagent files and folders", () => {
  const names = findClaudeSessionFiles(root).map((f) => path.basename(f)).sort();
  assert.deepEqual(names, [
    "1111aaaa-0000-0000-0000-000000000001.jsonl",
    "2222bbbb-0000-0000-0000-000000000002.jsonl",
    "3333cccc-0000-0000-0000-000000000003.jsonl",
    "4444dddd-0000-0000-0000-000000000004.jsonl",
  ]);
});

test("emits each session separately instead of one per project", () => {
  const { sessions, summary } = enumerateClaudeSessions(root);
  assert.equal(summary.scanned, 4);
  assert.equal(summary.emitted, 3);
  // The session with only a /model command and no typed prompt is left out.
  assert.equal(summary.skippedFiles, 1);
  assert.equal(byKey(sessions, "4444dddd-0000-0000-0000-000000000004"), undefined);
});

test("titles a session by the first prompt the user actually typed", () => {
  const { sessions } = enumerateClaudeSessions(root);
  const s = byKey(sessions, "1111aaaa-0000-0000-0000-000000000001");
  // Not the caveat, not the /clear wrapper, not the tool result; image dropped.
  assert.equal(s.title, "증거 패키지 인계 준비 파일 목록부터 정리해줘");
  assert.equal(s.originalIntent, "증거 패키지 인계 준비\n파일 목록부터 정리해줘");
  // The last main-chain reply, not the subagent's.
  assert.equal(s.nextAction, "Two PDFs found. Next I will write the index.");
  assert.equal(s.provider, "CLAUDE");
  assert.equal(s.sourceType, "session");
  assert.equal(s.projectKey, "record-to-evidence");
  assert.equal(s.startedAt, "2026-09-20T01:00:00.000Z");
  assert.equal(s.lastActivityAt, "2026-09-20T01:00:20.000Z");
});

test("prefers a /rename title over the first prompt", () => {
  const { sessions } = enumerateClaudeSessions(root);
  assert.equal(byKey(sessions, "2222bbbb-0000-0000-0000-000000000002").title, "rec34 증거 패키지 작업");
});

test("files a worktree session under the project it belongs to", () => {
  const { sessions } = enumerateClaudeSessions(root);
  assert.equal(byKey(sessions, "3333cccc-0000-0000-0000-000000000003").projectKey, "record-to-evidence");
  assert.equal(deriveProjectKey("/Users/dev/work/record-to-evidence/.claude/worktrees/review-ui-screen2/"), "record-to-evidence");
});

test("returns nothing for a missing projects directory", () => {
  const { sessions, summary } = enumerateClaudeSessions(path.join(root, "does-not-exist"));
  assert.equal(sessions.length, 0);
  assert.equal(summary.scanned, 0);
});
