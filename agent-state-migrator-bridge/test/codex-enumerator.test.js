import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractSessionFromFile, findRolloutFiles, enumerateCodexSessions } from "../src/codex-enumerator.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.join(here, "fixtures", "codex", name);

test("extractSessionFromFile parses session_meta into canonical fields", () => {
  const result = extractSessionFromFile(fixture("happy.jsonl"));
  assert.equal(result.provider, "CODEX");
  assert.equal(result.providerSessionKey, "aaaaaaaa-1111-2222-3333-444444444444");
  assert.equal(result.sourceType, "session");
  assert.equal(result.sourcePath, fixture("happy.jsonl"));
  assert.equal(result.startedAt, "2026-05-01T10:00:00.000Z");
  assert.equal(result.projectKey, "example-api");
});

test("extractSessionFromFile picks first event_msg/user_message as originalIntent", () => {
  const result = extractSessionFromFile(fixture("happy.jsonl"));
  assert.equal(result.originalIntent, "Fix the login bug please.");
});

test("extractSessionFromFile picks last agent_message as nextAction", () => {
  const result = extractSessionFromFile(fixture("happy.jsonl"));
  assert.equal(result.nextAction, "I will start by inspecting auth.ts and add a regression test.");
});

test("extractSessionFromFile falls back to last user_message when no agent_message", () => {
  const result = extractSessionFromFile(fixture("no-agent-message.jsonl"));
  assert.equal(result.nextAction, "Last ask");
});

test("extractSessionFromFile nextAction null when neither agent_message nor user_message", () => {
  const result = extractSessionFromFile(fixture("no-messages.jsonl"));
  assert.equal(result.nextAction, null);
});

test("extractSessionFromFile lastActivityAt from last line top-level timestamp", () => {
  const result = extractSessionFromFile(fixture("happy.jsonl"));
  assert.equal(result.lastActivityAt, "2026-05-01T10:00:31.000Z");
});

test("extractSessionFromFile lastActivityAt falls back to last timestamped line when only meta+context", () => {
  const result = extractSessionFromFile(fixture("no-messages.jsonl"));
  // no-messages.jsonl: session_meta (10:00:00) + turn_context (10:00:05). Last line with a timestamp is turn_context.
  assert.equal(result.lastActivityAt, "2026-05-01T10:00:05.000Z");
});

test("nextAction: empty agent_message does not shadow the user_message fallback", () => {
  const result = extractSessionFromFile(fixture("empty-agent-message.jsonl"));
  assert.equal(result.nextAction, "do the thing");
});

test("lastActivityAt falls back to startedAt when no line has a top-level timestamp", () => {
  const result = extractSessionFromFile(fixture("no-top-level-timestamp.jsonl"));
  assert.equal(result.startedAt, "2026-05-01T09:59:00.000Z");
  assert.equal(result.lastActivityAt, "2026-05-01T09:59:00.000Z");
});

test("extractSessionFromFile title is first 80 code points of originalIntent single-lined", () => {
  const result = extractSessionFromFile(fixture("happy.jsonl"));
  assert.equal(result.title, "Fix the login bug please.");
});

test("extractSessionFromFile title fallback uses '{projectKey} session {YYYY-MM-DD}' when no originalIntent", () => {
  const result = extractSessionFromFile(fixture("no-messages.jsonl"));
  assert.equal(result.title, "example-api session 2026-05-01");
});

test("title falls back when originalIntent is only whitespace", () => {
  const result = extractSessionFromFile(fixture("whitespace-intent.jsonl"));
  assert.equal(result.title, "example-api session 2026-05-01");
});

test("title collapses internal whitespace and newlines to single spaces", () => {
  const result = extractSessionFromFile(fixture("long-multiline-intent.jsonl"));
  // No newline or tab in the title; no double spaces.
  assert.equal(result.title.includes("\n"), false);
  assert.equal(result.title.includes("\t"), false);
  assert.equal(result.title.includes("  "), false);
  assert.ok(result.title.startsWith("Please refactor the authentication module and also update"));
});

test("title is capped at 80 code points", () => {
  const result = extractSessionFromFile(fixture("long-multiline-intent.jsonl"));
  assert.equal(Array.from(result.title).length, 80);
});

test("extractSessionFromFile returns null when first line is not session_meta", () => {
  const result = extractSessionFromFile(fixture("missing-meta.jsonl"));
  assert.equal(result, null);
});

test("extractSessionFromFile skips malformed lines and continues", () => {
  const result = extractSessionFromFile(fixture("malformed-line.jsonl"));
  assert.notEqual(result, null);
  assert.equal(result.originalIntent, "Survived the bad line");
  assert.equal(result.nextAction, "Continuing past corruption");
});

test("extractSessionFromFile replaces lone surrogates in extracted strings (regression)", () => {
  const result = extractSessionFromFile(fixture("lone-surrogate.jsonl"));
  assert.notEqual(result, null);
  // U+FFFD replaces the lone surrogates; the raw lone surrogates are gone
  assert.equal(result.originalIntent.includes("�"), true);
  assert.equal(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(result.originalIntent), false);
  assert.equal(result.nextAction.includes("�"), true);
  assert.equal(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(result.nextAction), false);
  // The whole record must JSON.stringify cleanly (the original crash concern)
  const json = JSON.stringify(result);
  assert.equal(JSON.parse(json).originalIntent.includes("�"), true);
});

test("findRolloutFiles walks a directory tree and returns only rollout-*.jsonl files", () => {
  const root = path.join(here, "fixtures", "codex-walk");
  const files = findRolloutFiles(root).sort();
  assert.deepEqual(files.map((f) => path.basename(f)), [
    "rollout-2026-05-01T10-00-00-aaaa.jsonl",
    "rollout-2026-05-02T11-00-00-bbbb.jsonl",
  ]);
});

test("findRolloutFiles returns empty array for a non-existent directory", () => {
  const files = findRolloutFiles(path.join(here, "fixtures", "does-not-exist-xyz"));
  assert.deepEqual(files, []);
});

test("extractSessionFromFile preserves the full cwd from session_meta", () => {
  const result = extractSessionFromFile(fixture("happy.jsonl"));
  assert.equal(result.cwd, "/Users/dev/projects/example-api");
});

test("extractSessionFromFile cwd is null when session_meta has no cwd", () => {
  const result = extractSessionFromFile(fixture("no-cwd.jsonl"));
  assert.equal(result.cwd, null);
});

test("enumerateCodexSessions walks a root, extracts sessions, returns summary", () => {
  const root = path.join(here, "fixtures", "codex-enumerate");
  const out = enumerateCodexSessions(root);
  assert.equal(out.summary.scanned, 3);
  assert.equal(out.summary.emitted, 2);    // A (happy) + C (malformed-but-recoverable); B (missing meta) skipped
  assert.equal(out.summary.skippedFiles, 1);
  assert.equal(out.sessions.length, 2);
  const ids = out.sessions.map((s) => s.providerSessionKey).sort();
  assert.deepEqual(ids, [
    "aaaaaaaa-1111-2222-3333-444444444444",
    "dddddddd-1111-2222-3333-444444444444",
  ]);
});

test("finds the prompt in rollouts that only log response_items", () => {
  // Older rollouts and some clients (the VS Code extension) never write the
  // event_msg, which left these sessions titled "<project> session <date>".
  const result = extractSessionFromFile(fixture("response-items-only.jsonl"));
  // The AGENTS.md and environment blocks come first and are not the prompt.
  assert.equal(result.originalIntent, "녹음 내용 녹취한 것 중에 강수창 발언만 추려줘");
  assert.equal(result.title, "녹음 내용 녹취한 것 중에 강수창 발언만 추려줘");
  assert.equal(result.nextAction, "발언 12개를 찾았어요. 다음으로 시간순으로 정리할게요.");
  assert.equal(result.projectKey, "record-to-evidence");
});

test("still prefers the event_msg prompt when both are present", () => {
  // The response_item can carry client-expanded extras; the event_msg is what was typed.
  const result = extractSessionFromFile(fixture("both-formats.jsonl"));
  assert.equal(result.originalIntent, "Fix the login bug please.");
});

test("looks past wrapper blocks and wrapper sections at the head of a block", () => {
  // Newer rollouts put AGENTS.md and the environment in their own blocks, and
  // can prefix the typed prompt with another environment section.
  const result = extractSessionFromFile(fixture("wrapper-blocks.jsonl"));
  assert.equal(result.originalIntent, "대화 예시 캡쳐로 모델 성능 개선하기");
  assert.equal(result.nextAction, "캡쳐 3장을 분석했어요.");
});

test("keeps a prompt the user wrapped in a tag of their own", () => {
  // Only Codex's own wrapper tags are stripped; "<task>" is the user's.
  const result = extractSessionFromFile(fixture("tagged-prompt.jsonl"));
  assert.equal(result.originalIntent, "<task>\n스코어 서비스 어드민 작업 범위 확인\n</task>");
  assert.equal(result.title, "<task> 스코어 서비스 어드민 작업 범위 확인 </task>");
});

test("takes the prompt from under Codex's '## My request:' heading", () => {
  // With the in-app browser or a file attached, Codex puts that context first
  // and heads what the user typed with "## My request:".
  const result = extractSessionFromFile(fixture("my-request-heading.jsonl"));
  assert.equal(result.originalIntent, "어드민 시안 색 대비 맞춰줘");
});

test("leaves out a session another agent delegated, which nobody typed into", () => {
  // Its only user turns are Codex's own blocks; the task came as agent_message.
  assert.equal(extractSessionFromFile(fixture("delegated-subsession.jsonl")), null);
});

test("keeps a session the user drove even if it messaged agents", () => {
  // A typed prompt means a person is behind it, whatever else it contains.
  const result = extractSessionFromFile(fixture("user-driven-with-agents.jsonl"));
  assert.equal(result.originalIntent, "대화 예시 캡쳐로 모델 성능 개선하기");
});

test("lists the delegated sub-sessions it leaves out, and nothing else", async () => {
  const { mkdtempSync, mkdirSync, copyFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { listDelegatedSubSessionIds } = await import("../src/codex-enumerator.js");
  // A ~/.codex/sessions-shaped tree: only rollout-*.jsonl files are considered.
  const root = mkdtempSync(path.join(tmpdir(), "codex-sessions-"));
  const day = path.join(root, "2026", "09", "17");
  mkdirSync(day, { recursive: true });
  for (const name of ["delegated-subsession", "user-driven-with-agents", "no-messages", "happy"]) {
    copyFileSync(fixture(`${name}.jsonl`), path.join(day, `rollout-${name}.jsonl`));
  }

  assert.deepEqual(listDelegatedSubSessionIds(root), ["efefefef-1111-2222-3333-444444444444"]);
});
