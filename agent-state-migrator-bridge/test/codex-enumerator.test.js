import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractSessionFromFile } from "../src/codex-enumerator.js";

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
