import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importSourceSessions } from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const codexEnumerateRoot = path.join(here, "fixtures", "codex-enumerate");
const claudeProjectsRoot = path.join(here, "fixtures", "claude-projects");

test("importSourceSessions with target=codex uses enumerator and emits rich fields", async () => {
  const payload = await importSourceSessions({
    target: "codex",
    codexHome: codexEnumerateRoot,   // points enumerator at fixture root directly
    cliPath: "/unused-for-codex-only",
  });
  assert.equal(payload.providers.includes("CODEX"), true);
  assert.equal(payload.sourceSessions.length, 2);
  const sample = payload.sourceSessions.find(
    (s) => s.providerSessionKey === "aaaaaaaa-1111-2222-3333-444444444444"
  );
  assert.equal(sample.provider, "CODEX");
  assert.equal(sample.title, "Fix the login bug please.");
  assert.equal(sample.originalIntent, "Fix the login bug please.");
  assert.equal(sample.nextAction, "I will start by inspecting auth.ts and add a regression test.");
  assert.equal(sample.projectKey, "example-api");
  assert.equal(sample.startedAt, "2026-05-01T10:00:00.000Z");
  assert.equal(sample.lastActivityAt, "2026-05-01T10:00:31.000Z");
  assert.equal(sample.metadata.cwd, "/Users/dev/projects/example-api");
  // Summary present
  assert.equal(payload.summary.codex.scanned, 3);
  assert.equal(payload.summary.codex.emitted, 2);
  assert.equal(payload.summary.codex.skippedFiles, 1);
});

test("importSourceSessions target=codex,claude reads both from disk, with no migrator", async () => {
  const payload = await importSourceSessions({
    target: "codex,claude",
    codexHome: codexEnumerateRoot,
    claudeHome: claudeProjectsRoot,
    // no cliPath: neither target needs the migrator any more
  });
  assert.deepEqual([...payload.providers].sort(), ["CLAUDE", "CODEX"]);
  assert.equal(payload.sourceSessions.filter((s) => s.provider === "CODEX").length, 2);
  const claude = payload.sourceSessions.filter((s) => s.provider === "CLAUDE");
  assert.equal(claude.length, 3);
  assert.ok(claude.every((s) => s.sourceType === "session"));
  assert.equal(payload.summary.claude.emitted, 3);
});
