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
