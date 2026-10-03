import { test } from "node:test";
import assert from "node:assert/strict";
import { collapseRepeatedPrompts } from "../src/repeat-collapser.js";

const REVIEW = "Review this change for security vulnerabilities. Changed files (you may Read the";

function session(key, title, lastActivityAt, overrides = {}) {
  return {
    provider: "CODEX",
    providerSessionKey: key,
    sourceType: "session",
    projectKey: "record-to-evidence",
    title,
    startedAt: lastActivityAt,
    lastActivityAt,
    originalIntent: `${title} ${key}.ts`,
    nextAction: `reply ${key}`,
    metadata: { sourceType: "session", cwd: "/x" },
    ...overrides,
  };
}

test("folds a templated prompt run many times into one session", () => {
  const input = [
    session("r1", REVIEW, "2026-09-01T00:00:00Z"),
    session("r3", REVIEW, "2026-09-03T00:00:00Z"),
    session("r2", REVIEW, "2026-09-02T00:00:00Z"),
    session("h1", "Fix the login bug", "2026-09-04T00:00:00Z"),
  ];
  const { sessions, collapsed } = collapseRepeatedPrompts(input);

  assert.equal(sessions.length, 2);
  assert.ok(sessions.some((s) => s.providerSessionKey === "h1"));
  const folded = sessions.find((s) => s.metadata.repeatedPrompt);
  // Newest run's content, earliest start, and the count for the record.
  assert.equal(folded.nextAction, "reply r3");
  assert.equal(folded.lastActivityAt, "2026-09-03T00:00:00Z");
  assert.equal(folded.startedAt, "2026-09-01T00:00:00Z");
  assert.equal(folded.metadata.repeatCount, 3);
  assert.equal(folded.metadata.latestSessionKey, "r3");
  assert.equal(folded.title, REVIEW);
  assert.match(folded.providerSessionKey, /^repeat-[0-9a-f]{32}$/);
  assert.deepEqual(collapsed.map((c) => c.count), [3]);
});

test("keeps the same key as more runs arrive, so the one thread is refreshed", () => {
  const three = [1, 2, 3].map((n) => session(`r${n}`, REVIEW, `2026-09-0${n}T00:00:00Z`));
  const four = [...three, session("r4", REVIEW, "2026-09-04T00:00:00Z")];
  const before = collapseRepeatedPrompts(three).sessions[0].providerSessionKey;
  const after = collapseRepeatedPrompts(four).sessions[0];
  assert.equal(after.providerSessionKey, before);
  assert.equal(after.nextAction, "reply r4");
});

test("leaves a prompt seen only twice alone", () => {
  const input = [session("a", REVIEW, "2026-09-01T00:00:00Z"), session("b", REVIEW, "2026-09-02T00:00:00Z")];
  const { sessions, collapsed } = collapseRepeatedPrompts(input);
  assert.deepEqual(sessions.map((s) => s.providerSessionKey), ["a", "b"]);
  assert.equal(collapsed.length, 0);
});

test("groups per project and per provider, not across them", () => {
  const input = [
    session("a1", REVIEW, "2026-09-01T00:00:00Z"),
    session("a2", REVIEW, "2026-09-02T00:00:00Z"),
    session("b1", REVIEW, "2026-09-03T00:00:00Z", { projectKey: "threadkeeper" }),
    session("c1", REVIEW, "2026-09-04T00:00:00Z", { provider: "CLAUDE" }),
  ];
  assert.equal(collapseRepeatedPrompts(input).collapsed.length, 0);
});

test("honours a custom threshold and ignores a nonsensical one", () => {
  const input = [session("a", REVIEW, "2026-09-01T00:00:00Z"), session("b", REVIEW, "2026-09-02T00:00:00Z")];
  assert.equal(collapseRepeatedPrompts(input, { minRepeats: 2 }).sessions.length, 1);
  assert.equal(collapseRepeatedPrompts(input, { minRepeats: Number.NaN }).sessions.length, 2);
  assert.equal(collapseRepeatedPrompts(input, { minRepeats: 1 }).sessions.length, 2);
});

test("never folds sessions that only share the untitled placeholder", () => {
  const untitled = "record-to-evidence session 2026-07-10";
  const input = [1, 2, 3, 4].map((n) =>
    session(`u${n}`, untitled, `2026-07-10T0${n}:00:00Z`, { originalIntent: null }),
  );
  const { sessions, collapsed } = collapseRepeatedPrompts(input);
  assert.equal(sessions.length, 4);
  assert.equal(collapsed.length, 0);
});
