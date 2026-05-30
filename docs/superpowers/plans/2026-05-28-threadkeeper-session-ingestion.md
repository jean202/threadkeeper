# ThreadKeeper Session-Level Codex Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ThreadKeeper's directory-aggregate Codex ingestion with per-rollout-file ingestion so each Codex session becomes exactly one thread, with rich per-session metadata (real intent, next action, project, timestamps) and a scoped reset operation to wipe the prior 29 aggregate threads cleanly.

**Architecture:** Bridge (pure Node) gains a Codex-specific enumerator that walks `~/.codex/sessions/**/rollout-*.jsonl`, parses each file (`session_meta` head + body line scan) with safe Unicode decoding, and emits one canonical `sourceSession` per file with typed rich fields. The Spring/Java API stays a thin mapper: DTOs gain the rich fields, the import service uses them to populate existing DB columns, disables title-merge to guarantee 1:1, and exposes `DELETE /api/v1/provider-connections/{id}/imports` for scoped reset. No DB migration.

**Tech Stack:** Node 20+ ESM (`node --test`), Java 21, Spring Boot, Spring Data JPA, JUnit 5, Postgres, Flyway, Gradle Kotlin DSL.

**Spec:** `docs/superpowers/specs/2026-05-28-threadkeeper-session-ingestion-design.md`

---

## File Map

**Bridge (`agent-state-migrator-bridge/`):**
- Create `src/sanitize.js` — safe Unicode helpers (surrogate replacement, control strip, NFC, code-point truncate).
- Create `src/codex-enumerator.js` — per-file Codex extraction (parse, derive fields, sanitize).
- Modify `src/index.js` — dispatch on `--target codex` to enumerator; merge into canonical payload; add summary block.
- Modify `src/cli.js` — accept `--codex-home` option.
- Create `test/sanitize.test.js`, `test/codex-enumerator.test.js`, `test/dispatch.test.js`.
- Create `test/fixtures/codex/*.jsonl` (small hand-crafted fixtures — NOT real session files).

**API (`threadkeeper-api/src/main/java/com/jean325/threadkeeper/`):**
- Modify `provider/dto/BridgeImportPayload.java` — add 5 rich fields to `SourceSessionPayload`.
- Modify `provider/dto/ImportSourceSessionsRequest.java` — add 4 rich fields to `SourceSessionImportRequest`.
- Create `provider/dto/ResetConnectionImportsResponse.java` — counts returned by reset.
- Modify `source/domain/SourceSession.java` — constructor + `refreshFromImport` accept `startedAt`/`lastActivityAt`.
- Modify `thread/domain/Thread.java` — add `applyImportedSession(...)` domain method.
- Modify `source/domain/SourceSessionRepository.java` — add `findAllByProviderConnectionId`.
- Modify `snapshot/domain/ThreadSnapshotRepository.java` — add `deleteAllByThreadIdIn`.
- Modify `thread/domain/ThreadRepository.java` — add `deleteAllByIdIn` (or use bulk via service).
- Modify `provider/application/ProviderConnectionService.java` — runImport mapping carries rich fields; importSingle's new path forces 1:1 for Codex sessions; refresh path updates timestamps + nextAction; new `resetConnectionImports(...)`.
- Modify `provider/api/ProviderConnectionController.java` — add `DELETE /{connectionId}/imports`.

**Test files (Java):**
- Create/modify under `src/test/java/com/jean325/threadkeeper/provider/`.

---

## Commands cheat-sheet

- Bridge tests: `cd agent-state-migrator-bridge && npm test`
- API single test: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.provider.application.ProviderConnectionServiceTest'`
- API all tests: `cd threadkeeper-api && ./gradlew test`

---

## Phase 1 — Bridge: safe Unicode primitives

### Task 1: `sanitize.js` — code-point truncation

**Files:**
- Create: `agent-state-migrator-bridge/src/sanitize.js`
- Create: `agent-state-migrator-bridge/test/sanitize.test.js`

- [ ] **Step 1: Write failing test**

```js
// agent-state-migrator-bridge/test/sanitize.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { truncateCodePoints } from "../src/sanitize.js";

test("truncateCodePoints keeps astral pairs intact at boundary", () => {
  // "한국어😀😀" → 5 code points: 한, 국, 어, 😀, 😀 (last two are 2 UTF-16 units each)
  const input = "한국어😀😀";
  assert.equal(truncateCodePoints(input, 4), "한국어😀");
  assert.equal(truncateCodePoints(input, 5), "한국어😀😀");
  assert.equal(truncateCodePoints(input, 10), "한국어😀😀");
});

test("truncateCodePoints returns empty for non-strings", () => {
  assert.equal(truncateCodePoints(null, 5), "");
  assert.equal(truncateCodePoints(undefined, 5), "");
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: FAIL — `truncateCodePoints` is not exported / module not found.

- [ ] **Step 3: Implement**

```js
// agent-state-migrator-bridge/src/sanitize.js
export function truncateCodePoints(value, max) {
  if (typeof value !== "string") return "";
  const codePoints = Array.from(value);
  if (codePoints.length <= max) return value;
  return codePoints.slice(0, max).join("");
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: PASS for both `truncateCodePoints` tests.

- [ ] **Step 5: Commit**

```bash
git add agent-state-migrator-bridge/src/sanitize.js agent-state-migrator-bridge/test/sanitize.test.js
git commit -m "Add code-point safe truncation helper"
```

---

### Task 2: `sanitize.js` — lone surrogate replacement

**Files:**
- Modify: `agent-state-migrator-bridge/src/sanitize.js`
- Modify: `agent-state-migrator-bridge/test/sanitize.test.js`

- [ ] **Step 1: Append failing test**

```js
// Add to agent-state-migrator-bridge/test/sanitize.test.js
import { replaceLoneSurrogates } from "../src/sanitize.js";

test("replaceLoneSurrogates replaces unpaired high surrogate with U+FFFD", () => {
  // \uD83D alone is a lone high surrogate (😀 = 😀)
  const input = "ok\uD83Dend";
  assert.equal(replaceLoneSurrogates(input), "ok�end");
});

test("replaceLoneSurrogates replaces unpaired low surrogate with U+FFFD", () => {
  const input = "ok\uDE00end";
  assert.equal(replaceLoneSurrogates(input), "ok�end");
});

test("replaceLoneSurrogates preserves valid surrogate pairs", () => {
  const input = "smile 😀 here";
  assert.equal(replaceLoneSurrogates(input), "smile 😀 here");
});

test("replaceLoneSurrogates handles non-string input", () => {
  assert.equal(replaceLoneSurrogates(null), "");
  assert.equal(replaceLoneSurrogates(undefined), "");
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: FAIL — `replaceLoneSurrogates` not exported.

- [ ] **Step 3: Implement**

```js
// Append to agent-state-migrator-bridge/src/sanitize.js
const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function replaceLoneSurrogates(value) {
  if (typeof value !== "string") return "";
  return value.replace(LONE_SURROGATE_RE, "�");
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: all four `replaceLoneSurrogates` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add agent-state-migrator-bridge/src/sanitize.js agent-state-migrator-bridge/test/sanitize.test.js
git commit -m "Replace lone Unicode surrogates with U+FFFD"
```

---

### Task 3: `sanitize.js` — full pipeline `sanitizeString(value, maxCodePoints)`

**Files:**
- Modify: `agent-state-migrator-bridge/src/sanitize.js`
- Modify: `agent-state-migrator-bridge/test/sanitize.test.js`

- [ ] **Step 1: Append failing tests**

```js
// Add to agent-state-migrator-bridge/test/sanitize.test.js
import { sanitizeString } from "../src/sanitize.js";

test("sanitizeString runs surrogate replace + control strip + NFC + truncate", () => {
  //  is BEL (control char); Å (Å) decomposed = "Å"; lone surrogate before truncation
  const input = "hi world\nÅ end\uD83Dtail";
  const out = sanitizeString(input, 1000);
  assert.equal(out.includes(""), false, "BEL stripped");
  assert.equal(out.includes("\n"), true, "newline preserved");
  assert.equal(out.includes("̊"), false, "decomposed form NFC-composed away");
  assert.equal(out.includes("Å"), true, "NFC composed Å present");
  assert.equal(out.includes("�"), true, "lone surrogate replaced");
});

test("sanitizeString truncates by code points after sanitizing", () => {
  const input = "😀😀😀😀😀";
  assert.equal(sanitizeString(input, 3), "😀😀😀");
});

test("sanitizeString returns empty for non-strings", () => {
  assert.equal(sanitizeString(null, 10), "");
  assert.equal(sanitizeString(undefined, 10), "");
  assert.equal(sanitizeString(42, 10), "");
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: FAIL — `sanitizeString` not exported.

- [ ] **Step 3: Implement**

```js
// Append to agent-state-migrator-bridge/src/sanitize.js
// Strip C0/C1 control chars except \n (
) and \t (	)
const CONTROL_RE = /[ ---]/g;

function stripControl(value) {
  return value.replace(CONTROL_RE, "");
}

export function sanitizeString(value, maxCodePoints) {
  if (typeof value !== "string") return "";
  let out = replaceLoneSurrogates(value);
  out = stripControl(out);
  out = out.normalize("NFC");
  out = truncateCodePoints(out, maxCodePoints);
  return out;
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agent-state-migrator-bridge/src/sanitize.js agent-state-migrator-bridge/test/sanitize.test.js
git commit -m "Add sanitizeString pipeline (surrogate, control, NFC, truncate)"
```

---

## Phase 2 — Bridge: Codex enumerator (per-file extraction)

Hand-crafted fixtures only. **Do NOT copy real `~/.codex/sessions/...` files into the repo.**

### Task 4: Fixture — happy path + extract session_meta-derived fields

**Files:**
- Create: `agent-state-migrator-bridge/test/fixtures/codex/happy.jsonl`
- Create: `agent-state-migrator-bridge/src/codex-enumerator.js`
- Create: `agent-state-migrator-bridge/test/codex-enumerator.test.js`

- [ ] **Step 1: Create fixture**

```jsonl
{"timestamp":"2026-05-01T10:00:00.000Z","type":"session_meta","payload":{"id":"aaaaaaaa-1111-2222-3333-444444444444","timestamp":"2026-05-01T10:00:00.000Z","cwd":"/Users/dev/projects/example-api","originator":"codex_cli_rs","cli_version":"0.55.0","instructions":"Be helpful.","source":"cli","model_provider":"openai"}}
{"timestamp":"2026-05-01T10:00:05.000Z","type":"event_msg","payload":{"type":"user_message","message":"Fix the login bug please."}}
{"timestamp":"2026-05-01T10:00:30.000Z","type":"event_msg","payload":{"type":"agent_message","message":"I will start by inspecting auth.ts and add a regression test."}}
{"timestamp":"2026-05-01T10:00:31.000Z","type":"turn_context","payload":{}}
```

- [ ] **Step 2: Write failing test**

```js
// agent-state-migrator-bridge/test/codex-enumerator.test.js
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
```

- [ ] **Step 3: Run test, expect failure**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: FAIL — `codex-enumerator.js` missing.

- [ ] **Step 4: Implement minimal extractor**

```js
// agent-state-migrator-bridge/src/codex-enumerator.js
import { readFileSync } from "node:fs";
import path from "node:path";
import { sanitizeString } from "./sanitize.js";

const TITLE_MAX = 200;
const PROJECT_KEY_MAX = 100;

function deriveProjectKey(cwd) {
  if (typeof cwd !== "string" || cwd.trim() === "") return "unknown";
  const base = path.basename(cwd).toLowerCase().replace(/[^a-z0-9._-]/g, "-");
  if (!base) return "unknown";
  return sanitizeString(base, PROJECT_KEY_MAX);
}

export function extractSessionFromFile(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return null;

  let meta;
  try {
    meta = JSON.parse(lines[0]);
  } catch {
    return null;
  }
  if (meta?.type !== "session_meta" || !meta.payload?.id) return null;

  const payload = meta.payload;
  return {
    provider: "CODEX",
    providerSessionKey: payload.id,
    sourceType: "session",
    sourcePath: filePath,
    startedAt: payload.timestamp ?? null,
    projectKey: deriveProjectKey(payload.cwd),
  };
}
```

- [ ] **Step 5: Run test, expect pass**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add agent-state-migrator-bridge/src/codex-enumerator.js agent-state-migrator-bridge/test/codex-enumerator.test.js agent-state-migrator-bridge/test/fixtures/codex/happy.jsonl
git commit -m "Extract session_meta fields from Codex rollout file"
```

---

### Task 5: Extract `originalIntent` from first `event_msg`/`user_message`

**Files:**
- Modify: `agent-state-migrator-bridge/src/codex-enumerator.js`
- Modify: `agent-state-migrator-bridge/test/codex-enumerator.test.js`

- [ ] **Step 1: Append failing test**

```js
// Append to agent-state-migrator-bridge/test/codex-enumerator.test.js
test("extractSessionFromFile picks first event_msg/user_message as originalIntent", () => {
  const result = extractSessionFromFile(fixture("happy.jsonl"));
  assert.equal(result.originalIntent, "Fix the login bug please.");
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: FAIL — `originalIntent` undefined.

- [ ] **Step 3: Implement**

```js
// Modify agent-state-migrator-bridge/src/codex-enumerator.js
// Add constants:
const INTENT_MAX = 4000;
const NEXT_ACTION_MAX = 4000;

// Add helper:
function safeParseLine(line) {
  try { return JSON.parse(line); } catch { return null; }
}

function findFirstUserMessage(lines) {
  for (let i = 1; i < lines.length; i += 1) {
    const obj = safeParseLine(lines[i]);
    if (!obj) continue;
    if (obj.type === "event_msg" && obj.payload?.type === "user_message") {
      const msg = obj.payload.message;
      if (typeof msg === "string" && msg.length > 0) {
        return sanitizeString(msg, INTENT_MAX);
      }
    }
  }
  return null;
}

// In extractSessionFromFile, after building the return object, add:
//   originalIntent: findFirstUserMessage(lines),
```

Updated function:

```js
export function extractSessionFromFile(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return null;

  const meta = safeParseLine(lines[0]);
  if (!meta || meta.type !== "session_meta" || !meta.payload?.id) return null;

  const payload = meta.payload;
  return {
    provider: "CODEX",
    providerSessionKey: payload.id,
    sourceType: "session",
    sourcePath: filePath,
    startedAt: payload.timestamp ?? null,
    projectKey: deriveProjectKey(payload.cwd),
    originalIntent: findFirstUserMessage(lines),
  };
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agent-state-migrator-bridge/src/codex-enumerator.js agent-state-migrator-bridge/test/codex-enumerator.test.js
git commit -m "Extract originalIntent from first user_message"
```

---

### Task 6: Extract `nextAction` (last agent_message, fallback last user_message, else null)

**Files:**
- Modify: `agent-state-migrator-bridge/src/codex-enumerator.js`
- Modify: `agent-state-migrator-bridge/test/codex-enumerator.test.js`
- Create: `agent-state-migrator-bridge/test/fixtures/codex/no-agent-message.jsonl`
- Create: `agent-state-migrator-bridge/test/fixtures/codex/no-messages.jsonl`

- [ ] **Step 1: Create fixtures**

`test/fixtures/codex/no-agent-message.jsonl`:
```jsonl
{"timestamp":"2026-05-01T10:00:00.000Z","type":"session_meta","payload":{"id":"bbbbbbbb-1111-2222-3333-444444444444","timestamp":"2026-05-01T10:00:00.000Z","cwd":"/Users/dev/projects/example-api","originator":"codex_cli_rs"}}
{"timestamp":"2026-05-01T10:00:05.000Z","type":"event_msg","payload":{"type":"user_message","message":"First ask"}}
{"timestamp":"2026-05-01T10:00:10.000Z","type":"event_msg","payload":{"type":"user_message","message":"Last ask"}}
```

`test/fixtures/codex/no-messages.jsonl`:
```jsonl
{"timestamp":"2026-05-01T10:00:00.000Z","type":"session_meta","payload":{"id":"cccccccc-1111-2222-3333-444444444444","timestamp":"2026-05-01T10:00:00.000Z","cwd":"/Users/dev/projects/example-api","originator":"codex_cli_rs"}}
{"timestamp":"2026-05-01T10:00:05.000Z","type":"turn_context","payload":{}}
```

- [ ] **Step 2: Append failing tests**

```js
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
```

- [ ] **Step 3: Run tests, expect failure**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: FAIL — `nextAction` undefined.

- [ ] **Step 4: Implement**

```js
// Append to agent-state-migrator-bridge/src/codex-enumerator.js
function findNextAction(lines) {
  let lastAgent = null;
  let lastUser = null;
  for (let i = 1; i < lines.length; i += 1) {
    const obj = safeParseLine(lines[i]);
    if (!obj || obj.type !== "event_msg") continue;
    const pt = obj.payload?.type;
    const msg = obj.payload?.message;
    if (typeof msg !== "string" || msg.length === 0) continue;
    if (pt === "agent_message") lastAgent = msg;
    else if (pt === "user_message") lastUser = msg;
  }
  const chosen = lastAgent ?? lastUser;
  return chosen == null ? null : sanitizeString(chosen, NEXT_ACTION_MAX);
}
```

Add `nextAction: findNextAction(lines)` to the returned object in `extractSessionFromFile`.

- [ ] **Step 5: Run tests, expect pass**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add agent-state-migrator-bridge/src/codex-enumerator.js agent-state-migrator-bridge/test/codex-enumerator.test.js agent-state-migrator-bridge/test/fixtures/codex/no-agent-message.jsonl agent-state-migrator-bridge/test/fixtures/codex/no-messages.jsonl
git commit -m "Extract nextAction with fallback to last user_message"
```

---

### Task 7: Extract `lastActivityAt` from last line `timestamp`

**Files:**
- Modify: `agent-state-migrator-bridge/src/codex-enumerator.js`
- Modify: `agent-state-migrator-bridge/test/codex-enumerator.test.js`

- [ ] **Step 1: Append failing test**

```js
test("extractSessionFromFile lastActivityAt from last line top-level timestamp", () => {
  const result = extractSessionFromFile(fixture("happy.jsonl"));
  assert.equal(result.lastActivityAt, "2026-05-01T10:00:31.000Z");
});

test("extractSessionFromFile lastActivityAt falls back to startedAt when only meta", () => {
  const result = extractSessionFromFile(fixture("no-messages.jsonl"));
  // no-messages.jsonl has session_meta + turn_context. Last line is turn_context at 10:00:05.
  assert.equal(result.lastActivityAt, "2026-05-01T10:00:05.000Z");
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: FAIL — `lastActivityAt` undefined.

- [ ] **Step 3: Implement**

```js
// Append to agent-state-migrator-bridge/src/codex-enumerator.js
function findLastActivityAt(lines, fallbackStartedAt) {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const obj = safeParseLine(lines[i]);
    if (obj && typeof obj.timestamp === "string") return obj.timestamp;
  }
  return fallbackStartedAt;
}
```

In `extractSessionFromFile`, capture `startedAt` first, then:
```js
const startedAt = payload.timestamp ?? null;
return {
  // ...existing fields with startedAt,
  lastActivityAt: findLastActivityAt(lines, startedAt),
};
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agent-state-migrator-bridge/src/codex-enumerator.js agent-state-migrator-bridge/test/codex-enumerator.test.js
git commit -m "Extract lastActivityAt from last line timestamp"
```

---

### Task 8: Derive `title` (80 code-points of originalIntent, fallback)

**Files:**
- Modify: `agent-state-migrator-bridge/src/codex-enumerator.js`
- Modify: `agent-state-migrator-bridge/test/codex-enumerator.test.js`

- [ ] **Step 1: Append failing tests**

```js
test("extractSessionFromFile title is first 80 code points of originalIntent single-lined", () => {
  const result = extractSessionFromFile(fixture("happy.jsonl"));
  assert.equal(result.title, "Fix the login bug please.");
});

test("extractSessionFromFile title fallback uses '{projectKey} session {YYYY-MM-DD}' when no originalIntent", () => {
  const result = extractSessionFromFile(fixture("no-messages.jsonl"));
  assert.equal(result.title, "example-api session 2026-05-01");
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: FAIL — `title` undefined.

- [ ] **Step 3: Implement**

```js
// Append to agent-state-migrator-bridge/src/codex-enumerator.js
const TITLE_CODE_POINTS = 80;

function deriveTitle(originalIntent, projectKey, startedAt) {
  if (typeof originalIntent === "string" && originalIntent.length > 0) {
    const singleLine = originalIntent.replace(/\s+/g, " ").trim();
    return sanitizeString(singleLine, TITLE_CODE_POINTS);
  }
  const date = (typeof startedAt === "string" ? startedAt.slice(0, 10) : "unknown");
  return sanitizeString(`${projectKey} session ${date}`, TITLE_MAX);
}
```

Use it in `extractSessionFromFile` after building originalIntent:
```js
const originalIntent = findFirstUserMessage(lines);
// ...
title: deriveTitle(originalIntent, projectKey, startedAt),
```

- [ ] **Step 4: Run tests, expect pass**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agent-state-migrator-bridge/src/codex-enumerator.js agent-state-migrator-bridge/test/codex-enumerator.test.js
git commit -m "Derive title from originalIntent with fallback"
```

---

### Task 9: Skip file without `session_meta` (returns null)

**Files:**
- Modify: `agent-state-migrator-bridge/test/codex-enumerator.test.js`
- Create: `agent-state-migrator-bridge/test/fixtures/codex/missing-meta.jsonl`

- [ ] **Step 1: Create fixture**

`test/fixtures/codex/missing-meta.jsonl`:
```jsonl
{"timestamp":"2026-05-01T10:00:00.000Z","type":"event_msg","payload":{"type":"user_message","message":"Orphan body line"}}
```

- [ ] **Step 2: Append failing test**

```js
test("extractSessionFromFile returns null when first line is not session_meta", () => {
  const result = extractSessionFromFile(fixture("missing-meta.jsonl"));
  assert.equal(result, null);
});
```

- [ ] **Step 3: Run test, expect pass (already implemented in Task 4)**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: PASS. (If FAIL, revisit the `meta.type !== "session_meta"` guard.)

- [ ] **Step 4: Commit**

```bash
git add agent-state-migrator-bridge/test/codex-enumerator.test.js agent-state-migrator-bridge/test/fixtures/codex/missing-meta.jsonl
git commit -m "Regression test: skip files without session_meta"
```

---

### Task 10: Skip malformed body lines without aborting

**Files:**
- Modify: `agent-state-migrator-bridge/test/codex-enumerator.test.js`
- Create: `agent-state-migrator-bridge/test/fixtures/codex/malformed-line.jsonl`

- [ ] **Step 1: Create fixture**

`test/fixtures/codex/malformed-line.jsonl`:
```jsonl
{"timestamp":"2026-05-01T10:00:00.000Z","type":"session_meta","payload":{"id":"dddddddd-1111-2222-3333-444444444444","timestamp":"2026-05-01T10:00:00.000Z","cwd":"/Users/dev/projects/example-api","originator":"codex_cli_rs"}}
{not valid json at all
{"timestamp":"2026-05-01T10:00:10.000Z","type":"event_msg","payload":{"type":"user_message","message":"Survived the bad line"}}
{"timestamp":"2026-05-01T10:00:20.000Z","type":"event_msg","payload":{"type":"agent_message","message":"Continuing past corruption"}}
```

- [ ] **Step 2: Append failing test**

```js
test("extractSessionFromFile skips malformed lines and continues", () => {
  const result = extractSessionFromFile(fixture("malformed-line.jsonl"));
  assert.notEqual(result, null);
  assert.equal(result.originalIntent, "Survived the bad line");
  assert.equal(result.nextAction, "Continuing past corruption");
});
```

- [ ] **Step 3: Run test, expect pass (already handled by safeParseLine in Tasks 5–7)**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add agent-state-migrator-bridge/test/codex-enumerator.test.js agent-state-migrator-bridge/test/fixtures/codex/malformed-line.jsonl
git commit -m "Regression test: malformed line skipped, scan continues"
```

---

### Task 11: Lone-surrogate regression — sanitizer prevents crash, payload stays clean

**Files:**
- Modify: `agent-state-migrator-bridge/test/codex-enumerator.test.js`
- Create: `agent-state-migrator-bridge/test/fixtures/codex/lone-surrogate.jsonl`

- [ ] **Step 1: Create fixture programmatically (it must contain an unpaired surrogate)**

Hand-writing the file directly via the harness Write tool would normalize the surrogate. Instead, generate the fixture inside a setup hook so the unpaired surrogate is written as raw UTF-8 (will produce a replacement byte in the file, but the test verifies the *parsed* JSON string contains the lone surrogate when read back through JSON). For determinism, we embed the unpaired surrogate using its JSON escape inside the message:

`test/fixtures/codex/lone-surrogate.jsonl`:
```jsonl
{"timestamp":"2026-05-01T10:00:00.000Z","type":"session_meta","payload":{"id":"eeeeeeee-1111-2222-3333-444444444444","timestamp":"2026-05-01T10:00:00.000Z","cwd":"/Users/dev/projects/example-api","originator":"codex_cli_rs"}}
{"timestamp":"2026-05-01T10:00:05.000Z","type":"event_msg","payload":{"type":"user_message","message":"prefix \uD83D middle"}}
{"timestamp":"2026-05-01T10:00:10.000Z","type":"event_msg","payload":{"type":"agent_message","message":"reply with bad \uDE00 trail"}}
```

(`"\uD83D"` and `"\uDE00"` written as JSON escapes — when parsed by `JSON.parse` they become lone-surrogate JS string values, exactly the crash trigger.)

- [ ] **Step 2: Append failing test**

```js
test("extractSessionFromFile replaces lone surrogates in extracted strings (regression)", () => {
  const result = extractSessionFromFile(fixture("lone-surrogate.jsonl"));
  assert.notEqual(result, null);
  // U+FFFD replaces the lone surrogates
  assert.equal(result.originalIntent.includes("�"), true);
  assert.equal(result.originalIntent.includes("\uD83D"), false);
  assert.equal(result.nextAction.includes("�"), true);
  assert.equal(result.nextAction.includes("\uDE00"), false);
  // And it must JSON.stringify cleanly (the original concern):
  const json = JSON.stringify(result);
  assert.equal(JSON.parse(json).originalIntent.includes("�"), true);
});
```

- [ ] **Step 3: Run test, expect pass (sanitizer already integrated in Tasks 5–6)**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add agent-state-migrator-bridge/test/codex-enumerator.test.js agent-state-migrator-bridge/test/fixtures/codex/lone-surrogate.jsonl
git commit -m "Regression test: lone surrogates sanitized in extracted fields"
```

---

## Phase 3 — Bridge: walk + dispatch + CLI

### Task 12: Directory walk for `rollout-*.jsonl`

**Files:**
- Modify: `agent-state-migrator-bridge/src/codex-enumerator.js`
- Modify: `agent-state-migrator-bridge/test/codex-enumerator.test.js`

- [ ] **Step 1: Append failing test**

```js
import { findRolloutFiles } from "../src/codex-enumerator.js";

test("findRolloutFiles walks fixtures/codex root and returns all rollout files", () => {
  // Create a sub-tree under fixtures for this test:
  // already covered by separate dir; instead, point at a temp tree we create on the fly:
  const tmpRoot = path.join(here, "fixtures", "codex-walk");
  // (Setup writes a synthetic tree if not present; see Step 3 — for simplicity create it manually in repo.)
  const files = findRolloutFiles(tmpRoot);
  files.sort();
  assert.deepEqual(files.map((f) => path.basename(f)), [
    "rollout-2026-05-01T10-00-00-aaaa.jsonl",
    "rollout-2026-05-02T11-00-00-bbbb.jsonl",
  ]);
});
```

- [ ] **Step 2: Create the walk fixture tree**

Create:
- `agent-state-migrator-bridge/test/fixtures/codex-walk/2026/05/01/rollout-2026-05-01T10-00-00-aaaa.jsonl` (one-line file: just the literal text `{}` is enough — content isn't asserted)
- `agent-state-migrator-bridge/test/fixtures/codex-walk/2026/05/02/rollout-2026-05-02T11-00-00-bbbb.jsonl` (also `{}`)
- `agent-state-migrator-bridge/test/fixtures/codex-walk/2026/05/01/not-a-rollout.txt` (`ignore-me`)

- [ ] **Step 3: Run test, expect failure**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: FAIL — `findRolloutFiles` not exported.

- [ ] **Step 4: Implement**

```js
// Append to agent-state-migrator-bridge/src/codex-enumerator.js
import { readdirSync, statSync, existsSync } from "node:fs";

export function findRolloutFiles(rootDir) {
  if (!existsSync(rootDir)) return [];
  const out = [];
  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && /^rollout-.+\.jsonl$/.test(entry.name)) {
        out.push(full);
      }
    }
  }
  walk(rootDir);
  return out;
}
```

- [ ] **Step 5: Run test, expect pass**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add agent-state-migrator-bridge/src/codex-enumerator.js agent-state-migrator-bridge/test/codex-enumerator.test.js agent-state-migrator-bridge/test/fixtures/codex-walk
git commit -m "Add recursive rollout file walker"
```

---

### Task 13: Enumerator entry — walk + extract + summary

**Files:**
- Modify: `agent-state-migrator-bridge/src/codex-enumerator.js`
- Modify: `agent-state-migrator-bridge/test/codex-enumerator.test.js`

- [ ] **Step 1: Append failing test**

```js
import { enumerateCodexSessions } from "../src/codex-enumerator.js";

test("enumerateCodexSessions walks a root, extracts sessions, returns summary", () => {
  // Use a fresh sub-fixture so happy + missing-meta + malformed live together
  const root = path.join(here, "fixtures", "codex-enumerate");
  // (See Step 2 for creating files in this root.)
  const out = enumerateCodexSessions(root);
  assert.equal(out.summary.scanned, 3);
  assert.equal(out.summary.emitted, 2);   // happy + malformed parse OK; missing-meta skipped
  assert.equal(out.summary.skippedFiles, 1);
  assert.equal(out.sessions.length, 2);
  const ids = out.sessions.map((s) => s.providerSessionKey).sort();
  assert.deepEqual(ids, [
    "aaaaaaaa-1111-2222-3333-444444444444",
    "dddddddd-1111-2222-3333-444444444444",
  ]);
});
```

- [ ] **Step 2: Create fixture tree**

Copy or replicate the existing fixture contents into:
- `agent-state-migrator-bridge/test/fixtures/codex-enumerate/2026/05/01/rollout-A.jsonl` ← content of `happy.jsonl`
- `agent-state-migrator-bridge/test/fixtures/codex-enumerate/2026/05/01/rollout-B.jsonl` ← content of `missing-meta.jsonl`
- `agent-state-migrator-bridge/test/fixtures/codex-enumerate/2026/05/02/rollout-C.jsonl` ← content of `malformed-line.jsonl`

- [ ] **Step 3: Run test, expect failure**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: FAIL — `enumerateCodexSessions` not exported.

- [ ] **Step 4: Implement**

```js
// Append to agent-state-migrator-bridge/src/codex-enumerator.js
export function enumerateCodexSessions(rootDir) {
  const files = findRolloutFiles(rootDir);
  const sessions = [];
  let skippedFiles = 0;
  const warnings = [];
  for (const file of files) {
    try {
      const s = extractSessionFromFile(file);
      if (s) sessions.push(s);
      else { skippedFiles += 1; warnings.push({ file, reason: "no session_meta" }); }
    } catch (err) {
      skippedFiles += 1;
      warnings.push({ file, reason: `extract failed: ${err.message}` });
    }
  }
  return {
    sessions,
    summary: {
      scanned: files.length,
      emitted: sessions.length,
      skippedFiles,
      warnings,
    },
  };
}
```

- [ ] **Step 5: Run test, expect pass**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add agent-state-migrator-bridge/src/codex-enumerator.js agent-state-migrator-bridge/test/codex-enumerator.test.js agent-state-migrator-bridge/test/fixtures/codex-enumerate
git commit -m "Add enumerator entry: walk + extract + summary"
```

---

### Task 14: `index.js` dispatch — `--target codex` uses enumerator, emits rich canonical payload

**Files:**
- Modify: `agent-state-migrator-bridge/src/index.js`
- Create: `agent-state-migrator-bridge/test/dispatch.test.js`

- [ ] **Step 1: Write failing test**

```js
// agent-state-migrator-bridge/test/dispatch.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importSourceSessions } from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const codexEnumerateRoot = path.join(here, "fixtures", "codex-enumerate");

test("importSourceSessions with target=codex uses enumerator", async () => {
  const payload = await importSourceSessions({
    target: "codex",
    codexHome: codexEnumerateRoot,   // points enumerator at fixture root directly
    cliPath: "/unused-for-codex-only",
  });
  assert.equal(payload.providers.includes("CODEX"), true);
  assert.equal(payload.sourceSessions.length, 2);
  const sample = payload.sourceSessions.find((s) => s.providerSessionKey === "aaaaaaaa-1111-2222-3333-444444444444");
  assert.equal(sample.provider, "CODEX");
  assert.equal(sample.title, "Fix the login bug please.");
  assert.equal(sample.originalIntent, "Fix the login bug please.");
  assert.equal(sample.nextAction, "I will start by inspecting auth.ts and add a regression test.");
  assert.equal(sample.projectKey, "example-api");
  assert.equal(sample.startedAt, "2026-05-01T10:00:00.000Z");
  assert.equal(sample.lastActivityAt, "2026-05-01T10:00:31.000Z");
  // Summary present
  assert.equal(payload.summary.codex.scanned, 3);
  assert.equal(payload.summary.codex.emitted, 2);
  assert.equal(payload.summary.codex.skippedFiles, 1);
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: FAIL — `target=codex` not yet wired.

- [ ] **Step 3: Modify `index.js`**

```js
// agent-state-migrator-bridge/src/index.js
// Add imports at top:
import os from "node:os";
import path from "node:path";
import { enumerateCodexSessions } from "./codex-enumerator.js";

// Add helper:
function targetsList(target) {
  return String(target ?? "").split(",").map((t) => t.trim()).filter(Boolean);
}

function defaultCodexHome() {
  return path.join(os.homedir(), ".codex");
}

function buildCodexSourceSessionsFromEnumeration(enumeration) {
  return enumeration.sessions.map((s) => ({
    provider: "CODEX",
    providerSessionKey: s.providerSessionKey,
    sourceType: s.sourceType,
    sourcePath: s.sourcePath,
    title: s.title,
    importedAt: new Date().toISOString(),
    startedAt: s.startedAt,
    lastActivityAt: s.lastActivityAt,
    projectKey: s.projectKey,
    originalIntent: s.originalIntent,
    nextAction: s.nextAction,
    metadata: {
      // Keep full cwd in metadata for traceability
      sourceType: s.sourceType,
    },
  }));
}

// Replace importSourceSessions:
export async function importSourceSessions(options) {
  const targets = targetsList(options.target ?? "codex,claude");
  const sourceSessions = [];
  const summary = {};

  if (targets.includes("codex")) {
    const codexRoot = path.join(options.codexHome ?? defaultCodexHome(), options.codexHome ? "" : "sessions");
    // When codexHome is provided explicitly (tests/configs), point at it directly.
    const root = options.codexHome ?? path.join(defaultCodexHome(), "sessions");
    const enumeration = enumerateCodexSessions(root);
    sourceSessions.push(...buildCodexSourceSessionsFromEnumeration(enumeration));
    summary.codex = enumeration.summary;
  }

  // Existing migrator-based path retained for non-codex targets:
  const nonCodex = targets.filter((t) => t !== "codex");
  if (nonCodex.length > 0 && options.cliPath) {
    const inspectResults = await inspectProviders({ ...options, target: nonCodex.join(",") });
    const mapped = mapInspectResultsToCanonicalImportPayload(inspectResults);
    sourceSessions.push(...mapped.sourceSessions);
  }

  const providers = [...new Set(sourceSessions.map((s) => s.provider))];
  return {
    importedAt: new Date().toISOString(),
    providers,
    sourceSessions,
    summary,
  };
}
```

(Adjust: drop the unused `codexRoot` line — keep only the final `const root = options.codexHome ?? path.join(defaultCodexHome(), "sessions");`.)

- [ ] **Step 4: Run test, expect pass**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agent-state-migrator-bridge/src/index.js agent-state-migrator-bridge/test/dispatch.test.js
git commit -m "Dispatch target=codex to enumerator; emit rich canonical payload"
```

---

### Task 15: CLI — `--codex-home` option

**Files:**
- Modify: `agent-state-migrator-bridge/src/cli.js`
- Modify: `agent-state-migrator-bridge/test/bridge.test.js`

- [ ] **Step 1: Append failing test (parseArguments still inlined; export it for testability)**

```js
// agent-state-migrator-bridge/test/bridge.test.js (append)
import { parseArguments } from "../src/cli.js";

test("parseArguments accepts --codex-home option", () => {
  const opts = parseArguments(["--target", "codex", "--codex-home", "/tmp/codex"]);
  assert.equal(opts.target, "codex");
  assert.equal(opts.codexHome, "/tmp/codex");
  // cliPath no longer required when target excludes non-codex providers
});

test("parseArguments still requires --migrator-path when target includes claude", () => {
  assert.throws(() => parseArguments(["--target", "codex,claude"]),
    /migrator-path is required/);
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: FAIL — `parseArguments` not exported / `--codex-home` not recognized.

- [ ] **Step 3: Modify `cli.js`**

```js
// agent-state-migrator-bridge/src/cli.js
#!/usr/bin/env node
import { importSourceSessions } from "./index.js";

export function parseArguments(argv) {
  const options = {
    profile: "full",
    target: "codex,claude",
    includeSensitive: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : undefined;
    switch (token) {
      case "--migrator-path": options.cliPath = value; index += 1; break;
      case "--profile":       options.profile = value; index += 1; break;
      case "--target":        options.target = value; index += 1; break;
      case "--codex-home":    options.codexHome = value; index += 1; break;
      case "--include-sensitive": options.includeSensitive = true; break;
      default: break;
    }
  }

  const targets = String(options.target).split(",").map((t) => t.trim()).filter(Boolean);
  const needsMigrator = targets.some((t) => t !== "codex");
  if (needsMigrator && !options.cliPath) {
    throw new Error("--migrator-path is required");
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const payload = await importSourceSessions(options);
  console.log(JSON.stringify(payload, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `cd agent-state-migrator-bridge && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agent-state-migrator-bridge/src/cli.js agent-state-migrator-bridge/test/bridge.test.js
git commit -m "CLI: add --codex-home; relax migrator requirement when target is codex-only"
```

---

## Phase 4 — Java DTOs

### Task 16: `BridgeImportPayload.SourceSessionPayload` — add 5 rich fields

**Files:**
- Modify: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/dto/BridgeImportPayload.java`
- Create: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/dto/BridgeImportPayloadJsonTest.java`

- [ ] **Step 1: Write failing test**

```java
// threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/dto/BridgeImportPayloadJsonTest.java
package com.jean325.threadkeeper.provider.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BridgeImportPayloadJsonTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void deserializesRichSourceSessionFields() throws Exception {
        String json = """
            {
              "importedAt": "2026-05-30T00:00:00Z",
              "providers": ["CODEX"],
              "sourceSessions": [{
                "provider": "CODEX",
                "providerSessionKey": "id-1",
                "sourceType": "session",
                "sourcePath": "/path/rollout-x.jsonl",
                "title": "Fix login",
                "importedAt": "2026-05-30T00:00:00Z",
                "metadataJson": "{}",
                "startedAt": "2026-05-01T10:00:00Z",
                "lastActivityAt": "2026-05-01T10:30:00Z",
                "projectKey": "example-api",
                "originalIntent": "Fix the login bug",
                "nextAction": "Inspect auth.ts"
              }]
            }
            """;
        BridgeImportPayload payload = mapper.readValue(json, BridgeImportPayload.class);
        BridgeImportPayload.SourceSessionPayload s = payload.sourceSessions().get(0);
        assertThat(s.startedAt()).isEqualTo("2026-05-01T10:00:00Z");
        assertThat(s.lastActivityAt()).isEqualTo("2026-05-01T10:30:00Z");
        assertThat(s.projectKey()).isEqualTo("example-api");
        assertThat(s.originalIntent()).isEqualTo("Fix the login bug");
        assertThat(s.nextAction()).isEqualTo("Inspect auth.ts");
    }
}
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.provider.dto.BridgeImportPayloadJsonTest'`
Expected: FAIL — record accessors not present.

- [ ] **Step 3: Modify the record**

```java
// threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/dto/BridgeImportPayload.java
package com.jean325.threadkeeper.provider.dto;

import java.util.List;

public record BridgeImportPayload(
        String importedAt,
        List<String> providers,
        List<SourceSessionPayload> sourceSessions
) {
    public record SourceSessionPayload(
            String provider,
            String providerSessionKey,
            String sourceType,
            String sourcePath,
            String title,
            String importedAt,
            String metadataJson,
            String startedAt,
            String lastActivityAt,
            String projectKey,
            String originalIntent,
            String nextAction
    ) {
    }
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.provider.dto.BridgeImportPayloadJsonTest'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/dto/BridgeImportPayload.java threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/dto/BridgeImportPayloadJsonTest.java
git commit -m "Add rich fields to BridgeImportPayload.SourceSessionPayload"
```

---

### Task 17: `ImportSourceSessionsRequest.SourceSessionImportRequest` — add 4 rich fields

**Files:**
- Modify: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/dto/ImportSourceSessionsRequest.java`
- Create: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/dto/ImportSourceSessionsRequestJsonTest.java`

- [ ] **Step 1: Write failing test**

```java
// threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/dto/ImportSourceSessionsRequestJsonTest.java
package com.jean325.threadkeeper.provider.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ImportSourceSessionsRequestJsonTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void deserializesRichImportFields() throws Exception {
        String json = """
            {
              "profile": "full",
              "includeSensitive": false,
              "sourceSessions": [{
                "provider": "CODEX",
                "providerSessionKey": "id-1",
                "sourceType": "session",
                "sourcePath": "/p/rollout.jsonl",
                "title": "Fix login",
                "projectKey": "example-api",
                "originalIntent": "intent",
                "nextAction": "next",
                "startedAt": "2026-05-01T10:00:00Z",
                "lastActivityAt": "2026-05-01T10:30:00Z",
                "metadataJson": "{}"
              }]
            }
            """;
        ImportSourceSessionsRequest req = mapper.readValue(json, ImportSourceSessionsRequest.class);
        ImportSourceSessionsRequest.SourceSessionImportRequest s = req.sourceSessions().get(0);
        assertThat(s.originalIntent()).isEqualTo("intent");
        assertThat(s.nextAction()).isEqualTo("next");
        assertThat(s.startedAt()).isEqualTo("2026-05-01T10:00:00Z");
        assertThat(s.lastActivityAt()).isEqualTo("2026-05-01T10:30:00Z");
    }
}
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.provider.dto.ImportSourceSessionsRequestJsonTest'`
Expected: FAIL.

- [ ] **Step 3: Modify the record**

```java
// threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/dto/ImportSourceSessionsRequest.java
package com.jean325.threadkeeper.provider.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ImportSourceSessionsRequest(
        @NotBlankOrNull String profile,
        boolean includeSensitive,
        @NotNull @NotEmpty @Valid List<SourceSessionImportRequest> sourceSessions
) {
    public record SourceSessionImportRequest(
            Long threadId,
            @Size(max = 100) String projectKey,
            @NotNull String provider,
            @NotNull @Size(max = 200) String providerSessionKey,
            @NotNull @Size(max = 50) String sourceType,
            @Size(max = 500) String sourcePath,
            @Size(max = 200) String title,
            String metadataJson,
            String originalIntent,
            String nextAction,
            String startedAt,
            String lastActivityAt
    ) {
    }
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.provider.dto.ImportSourceSessionsRequestJsonTest'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/dto/ImportSourceSessionsRequest.java threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/dto/ImportSourceSessionsRequestJsonTest.java
git commit -m "Add rich fields to SourceSessionImportRequest"
```

---

## Phase 5 — Java domain changes

### Task 18: `SourceSession` — constructor + refresh accept `startedAt`/`lastActivityAt`

**Files:**
- Modify: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/source/domain/SourceSession.java`
- Create: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/source/domain/SourceSessionDomainTest.java`

- [ ] **Step 1: Write failing test**

```java
// threadkeeper-api/src/test/java/com/jean325/threadkeeper/source/domain/SourceSessionDomainTest.java
package com.jean325.threadkeeper.source.domain;

import com.jean325.threadkeeper.provider.domain.ProviderConnection;
import com.jean325.threadkeeper.provider.domain.ProviderType;
import com.jean325.threadkeeper.thread.domain.Thread;
import com.jean325.threadkeeper.thread.domain.ThreadPriority;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class SourceSessionDomainTest {

    @Test
    void constructorPopulatesStartedAndLastActivityFromArguments() {
        Thread thread = new Thread("k", "t", ThreadPriority.MEDIUM, "intent", null, "done");
        ProviderConnection conn = new ProviderConnection(ProviderType.CODEX, "label", null);
        Instant started = Instant.parse("2026-05-01T10:00:00Z");
        Instant last = Instant.parse("2026-05-01T10:30:00Z");

        SourceSession s = new SourceSession(thread, conn, "key", ProviderType.CODEX,
                "/path", "session", "title", "{}", started, last);

        assertThat(s.getStartedAt()).isEqualTo(started);
        assertThat(s.getLastActivityAt()).isEqualTo(last);
    }

    @Test
    void refreshFromImportUpdatesStartedAndLastActivity() {
        Thread thread = new Thread("k", "t", ThreadPriority.MEDIUM, "intent", null, "done");
        ProviderConnection conn = new ProviderConnection(ProviderType.CODEX, "label", null);
        SourceSession s = new SourceSession(thread, conn, "key", ProviderType.CODEX,
                "/path", "session", "title", "{}",
                Instant.parse("2026-05-01T10:00:00Z"),
                Instant.parse("2026-05-01T10:30:00Z"));

        Instant newLast = Instant.parse("2026-05-02T11:00:00Z");
        s.refreshFromImport("/new", "session", "newtitle", "{}",
                Instant.parse("2026-05-01T10:00:00Z"), newLast);

        assertThat(s.getLastActivityAt()).isEqualTo(newLast);
        assertThat(s.getSourcePath()).isEqualTo("/new");
        assertThat(s.getTitle()).isEqualTo("newtitle");
    }
}
```

- [ ] **Step 2: Run tests, expect failure**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.source.domain.SourceSessionDomainTest'`
Expected: FAIL — constructor signature mismatch.

- [ ] **Step 3: Modify domain**

Replace constructor and `refreshFromImport` (plus add `getStartedAt()`):

```java
// In SourceSession.java
public SourceSession(
        Thread thread,
        ProviderConnection providerConnection,
        String providerSessionKey,
        ProviderType provider,
        String sourcePath,
        String sourceType,
        String title,
        String metadataJson,
        Instant startedAt,
        Instant lastActivityAt
) {
    this.thread = thread;
    this.providerConnection = providerConnection;
    this.providerSessionKey = providerSessionKey;
    this.provider = provider;
    this.sourcePath = sourcePath;
    this.sourceType = sourceType;
    this.title = title;
    this.importedAt = Instant.now();
    this.startedAt = startedAt;
    this.lastActivityAt = lastActivityAt != null ? lastActivityAt : this.importedAt;
    this.metadataJson = metadataJson == null || metadataJson.isBlank() ? "{}" : metadataJson;
}

public Instant getStartedAt() { return startedAt; }
public Instant getLastActivityAt() { return lastActivityAt; }

public void refreshFromImport(
        String sourcePath,
        String sourceType,
        String title,
        String metadataJson,
        Instant startedAt,
        Instant lastActivityAt
) {
    this.sourcePath = sourcePath;
    this.sourceType = sourceType;
    this.title = title;
    this.importedAt = Instant.now();
    if (startedAt != null) this.startedAt = startedAt;
    this.lastActivityAt = lastActivityAt != null ? lastActivityAt : this.importedAt;
    this.metadataJson = metadataJson == null || metadataJson.isBlank() ? "{}" : metadataJson;
}
```

(Update any in-source callers of the old signatures — currently only `ProviderConnectionService.importSingle`; Task 21 fixes that.) For now, also keep a deprecated bridge by overloading the old constructor temporarily so the project compiles:

```java
public SourceSession(
        Thread thread, ProviderConnection providerConnection, String providerSessionKey,
        ProviderType provider, String sourcePath, String sourceType, String title, String metadataJson
) {
    this(thread, providerConnection, providerSessionKey, provider,
            sourcePath, sourceType, title, metadataJson, null, null);
}

public void refreshFromImport(String sourcePath, String sourceType, String title, String metadataJson) {
    refreshFromImport(sourcePath, sourceType, title, metadataJson, null, null);
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.source.domain.SourceSessionDomainTest'`
Expected: PASS.

- [ ] **Step 5: Run full module tests to confirm no other breakage**

Run: `cd threadkeeper-api && ./gradlew test`
Expected: PASS (the overloaded old constructor preserves existing callers).

- [ ] **Step 6: Commit**

```bash
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/source/domain/SourceSession.java threadkeeper-api/src/test/java/com/jean325/threadkeeper/source/domain/SourceSessionDomainTest.java
git commit -m "SourceSession: accept startedAt/lastActivityAt in constructor and refresh"
```

---

### Task 19: `Thread.applyImportedSession(...)` overwrites placeholders

**Files:**
- Modify: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/thread/domain/Thread.java`
- Create: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/thread/domain/ThreadApplyImportedSessionTest.java`

- [ ] **Step 1: Write failing test**

```java
// threadkeeper-api/src/test/java/com/jean325/threadkeeper/thread/domain/ThreadApplyImportedSessionTest.java
package com.jean325.threadkeeper.thread.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class ThreadApplyImportedSessionTest {

    @Test
    void applyImportedSessionOverwritesIntentNextActionAndLastActivity() {
        Thread thread = new Thread(
                "imported-codex", "placeholder title", ThreadPriority.MEDIUM,
                "Imported from CODEX session.",   // placeholder original intent
                "Review imported context.",        // placeholder todayGoal
                "Thread is classified."
        );
        Instant when = Instant.parse("2026-05-02T15:00:00Z");

        thread.applyImportedSession("Real first user prompt", "Last agent statement", when);

        assertThat(thread.getOriginalIntent()).isEqualTo("Real first user prompt");
        assertThat(thread.getCurrentNextAction()).isEqualTo("Last agent statement");
        assertThat(thread.getLastActivityAt()).isEqualTo(when);
    }

    @Test
    void applyImportedSessionKeepsExistingValueWhenArgumentIsNull() {
        Thread thread = new Thread("k", "t", ThreadPriority.MEDIUM, "intent", "todayGoal", "done");
        Instant before = thread.getLastActivityAt();

        thread.applyImportedSession(null, null, null);

        assertThat(thread.getOriginalIntent()).isEqualTo("intent");
        assertThat(thread.getCurrentNextAction()).isEqualTo("todayGoal");
        assertThat(thread.getLastActivityAt()).isEqualTo(before);
    }
}
```

- [ ] **Step 2: Run tests, expect failure**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.thread.domain.ThreadApplyImportedSessionTest'`
Expected: FAIL — method missing.

- [ ] **Step 3: Add method to `Thread.java`**

```java
// In Thread.java
public void applyImportedSession(String originalIntent, String currentNextAction, Instant lastActivityAt) {
    if (originalIntent != null && !originalIntent.isBlank()) {
        this.originalIntent = originalIntent;
    }
    if (currentNextAction != null && !currentNextAction.isBlank()) {
        this.currentNextAction = currentNextAction;
    }
    if (lastActivityAt != null) {
        this.lastActivityAt = lastActivityAt;
    }
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.thread.domain.ThreadApplyImportedSessionTest'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/thread/domain/Thread.java threadkeeper-api/src/test/java/com/jean325/threadkeeper/thread/domain/ThreadApplyImportedSessionTest.java
git commit -m "Thread: add applyImportedSession to overwrite import placeholders"
```

---

## Phase 6 — Java service wiring

### Task 20: `runImport` carries new fields end-to-end (service-level test, no bridge process)

**Files:**
- Modify: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/application/ProviderConnectionService.java`
- Modify: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/api/ProviderConnectionRunImportControllerTest.java` (or create a focused service test)
- Create: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/application/ProviderConnectionServiceRichFieldTest.java`

- [ ] **Step 1: Write failing test (mock BridgeImportClient)**

```java
// ProviderConnectionServiceRichFieldTest.java
package com.jean325.threadkeeper.provider.application;

import com.jean325.threadkeeper.provider.dto.BridgeImportPayload;
import com.jean325.threadkeeper.provider.dto.CreateProviderConnectionRequest;
import com.jean325.threadkeeper.provider.dto.ProviderConnectionResponse;
import com.jean325.threadkeeper.provider.dto.RunProviderImportRequest;
import com.jean325.threadkeeper.provider.domain.ProviderType;
import com.jean325.threadkeeper.source.domain.SourceSession;
import com.jean325.threadkeeper.source.domain.SourceSessionRepository;
import com.jean325.threadkeeper.thread.domain.Thread;
import com.jean325.threadkeeper.thread.domain.ThreadRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
@Transactional
class ProviderConnectionServiceRichFieldTest {

    @Autowired ProviderConnectionService service;
    @Autowired SourceSessionRepository sourceSessionRepository;
    @Autowired ThreadRepository threadRepository;
    @MockBean BridgeImportClient bridgeImportClient;

    private Long connectionId;

    @BeforeEach
    void setUp() {
        ProviderConnectionResponse created = service.createConnection(
                new CreateProviderConnectionRequest(ProviderType.CODEX, "label", null));
        connectionId = created.id();
    }

    @Test
    void runImportPopulatesThreadWithRichFields() {
        BridgeImportPayload payload = new BridgeImportPayload(
                "2026-05-30T00:00:00Z",
                List.of("CODEX"),
                List.of(new BridgeImportPayload.SourceSessionPayload(
                        "CODEX", "session-1", "session", "/p/rollout.jsonl",
                        "Fix login", "2026-05-30T00:00:00Z", "{}",
                        "2026-05-01T10:00:00Z", "2026-05-01T10:30:00Z",
                        "example-api", "Fix the login bug", "Inspect auth.ts"))
        );
        when(bridgeImportClient.runImport(any(RunProviderImportRequest.class))).thenReturn(payload);

        service.runImport(connectionId, new RunProviderImportRequest(
                "/unused", "/unused", "full", "codex", false));

        SourceSession s = sourceSessionRepository
                .findByProviderConnectionIdAndProviderSessionKey(connectionId, "session-1")
                .orElseThrow();
        Thread thread = s.getThread();
        assertThat(thread.getOriginalIntent()).isEqualTo("Fix the login bug");
        assertThat(thread.getCurrentNextAction()).isEqualTo("Inspect auth.ts");
        assertThat(thread.getProjectKey()).isEqualTo("example-api");
        assertThat(thread.getTitle()).isEqualTo("Fix login");
        assertThat(s.getStartedAt().toString()).isEqualTo("2026-05-01T10:00:00Z");
        assertThat(s.getLastActivityAt().toString()).isEqualTo("2026-05-01T10:30:00Z");
        assertThat(thread.getLastActivityAt().toString()).isEqualTo("2026-05-01T10:30:00Z");
    }
}
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.provider.application.ProviderConnectionServiceRichFieldTest'`
Expected: FAIL — service mapping does not yet carry the new fields.

- [ ] **Step 3: Modify `ProviderConnectionService.runImport` mapping + `importSingle` to apply rich fields**

```java
// In ProviderConnectionService.java — runImport:
@Transactional
public List<SourceSessionResponse> runImport(Long connectionId, RunProviderImportRequest request) {
    BridgeImportPayload payload = bridgeImportClient.runImport(request);
    ImportSourceSessionsRequest importRequest = new ImportSourceSessionsRequest(
            request.profile() == null ? "full" : request.profile(),
            request.includeSensitive(),
            payload.sourceSessions().stream()
                    .map(item -> new ImportSourceSessionsRequest.SourceSessionImportRequest(
                            null,
                            item.projectKey(),
                            item.provider(),
                            item.providerSessionKey(),
                            item.sourceType(),
                            item.sourcePath(),
                            item.title(),
                            item.metadataJson(),
                            item.originalIntent(),
                            item.nextAction(),
                            item.startedAt(),
                            item.lastActivityAt()
                    ))
                    .toList()
    );
    return importSourceSessions(connectionId, importRequest);
}
```

Add a helper to parse the `Instant`:

```java
private static Instant parseInstantOrNull(String value) {
    if (value == null || value.isBlank()) return null;
    try { return Instant.parse(value); } catch (Exception ex) { return null; }
}
```

In `importSingle` (new path, after constructing the new SourceSession):

```java
private SourceSession importSingle(
        ProviderConnection connection,
        ImportSourceSessionsRequest.SourceSessionImportRequest item
) {
    ProviderType providerType = ProviderType.valueOf(item.provider());
    Instant startedAt = parseInstantOrNull(item.startedAt());
    Instant lastActivityAt = parseInstantOrNull(item.lastActivityAt());

    SourceSession existing = sourceSessionRepository
            .findByProviderConnectionIdAndProviderSessionKey(connection.getId(), item.providerSessionKey())
            .orElse(null);
    if (existing != null) {
        existing.refreshFromImport(item.sourcePath(), item.sourceType(), item.title(), item.metadataJson(), startedAt, lastActivityAt);
        // Refresh thread: nextAction + lastActivity; keep originalIntent
        existing.getThread().applyImportedSession(null, item.nextAction(), lastActivityAt);
        threadSnapshotRepository.save(new ThreadSnapshot(
                existing.getThread(), SnapshotType.PROGRESS,
                "Refreshed imported source session from " + providerType.name() + ".",
                "Review updated context.", null, null, null));
        return existing;
    }

    Thread thread = findOrCreateThreadForImport(providerType, item);
    thread.applyImportedSession(item.originalIntent(), item.nextAction(), lastActivityAt);

    SourceSession sourceSession = sourceSessionRepository.save(new SourceSession(
            thread, connection,
            item.providerSessionKey(), providerType,
            item.sourcePath(), item.sourceType(), item.title(), item.metadataJson(),
            startedAt, lastActivityAt
    ));

    threadSnapshotRepository.save(new ThreadSnapshot(
            thread, SnapshotType.PROGRESS,
            "Imported source session from " + providerType.name() + ".",
            "Review imported thread and decide whether to merge or continue.",
            null, null, null));

    return sourceSession;
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.provider.application.ProviderConnectionServiceRichFieldTest'`
Expected: PASS.

- [ ] **Step 5: Run full suite to confirm no regressions**

Run: `cd threadkeeper-api && ./gradlew test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/application/ProviderConnectionService.java threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/application/ProviderConnectionServiceRichFieldTest.java
git commit -m "Apply rich import fields to Thread/SourceSession on new+refresh"
```

---

### Task 21: 1:1 — disable title-merge for Codex session imports

**Files:**
- Modify: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/application/ProviderConnectionService.java`
- Create: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/application/ProviderConnectionServiceOneToOneTest.java`

- [ ] **Step 1: Write failing test**

```java
// ProviderConnectionServiceOneToOneTest.java
package com.jean325.threadkeeper.provider.application;

import com.jean325.threadkeeper.provider.dto.*;
import com.jean325.threadkeeper.provider.domain.ProviderType;
import com.jean325.threadkeeper.source.domain.SourceSession;
import com.jean325.threadkeeper.source.domain.SourceSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class ProviderConnectionServiceOneToOneTest {

    @Autowired ProviderConnectionService service;
    @Autowired SourceSessionRepository sourceSessionRepository;

    private Long connectionId;

    @BeforeEach
    void setUp() {
        connectionId = service.createConnection(
                new CreateProviderConnectionRequest(ProviderType.CODEX, "label", null)).id();
    }

    @Test
    void twoCodexSessionsWithIdenticalTitleProduceTwoThreads() {
        ImportSourceSessionsRequest.SourceSessionImportRequest a =
                new ImportSourceSessionsRequest.SourceSessionImportRequest(
                        null, "example-api", "CODEX", "id-A", "session", "/p/a.jsonl",
                        "Same title", "{}", "intent-a", "next-a", null, null);
        ImportSourceSessionsRequest.SourceSessionImportRequest b =
                new ImportSourceSessionsRequest.SourceSessionImportRequest(
                        null, "example-api", "CODEX", "id-B", "session", "/p/b.jsonl",
                        "Same title", "{}", "intent-b", "next-b", null, null);

        service.importSourceSessions(connectionId, new ImportSourceSessionsRequest("full", false, List.of(a, b)));

        SourceSession sA = sourceSessionRepository
                .findByProviderConnectionIdAndProviderSessionKey(connectionId, "id-A").orElseThrow();
        SourceSession sB = sourceSessionRepository
                .findByProviderConnectionIdAndProviderSessionKey(connectionId, "id-B").orElseThrow();
        assertThat(sA.getThread().getId()).isNotEqualTo(sB.getThread().getId());
        assertThat(sA.getThread().getOriginalIntent()).isEqualTo("intent-a");
        assertThat(sB.getThread().getOriginalIntent()).isEqualTo("intent-b");
    }
}
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.provider.application.ProviderConnectionServiceOneToOneTest'`
Expected: FAIL — current `findOrCreateThreadForImport` merges by title.

- [ ] **Step 3: Modify `findOrCreateThreadForImport` to skip title-merge for session imports**

```java
// In ProviderConnectionService.java
private Thread findOrCreateThreadForImport(
        ProviderType providerType,
        ImportSourceSessionsRequest.SourceSessionImportRequest item
) {
    if (item.threadId() != null) {
        Thread explicitThread = threadRepository.findById(item.threadId()).orElseThrow();
        explicitThread.touch("Review linked import for " + providerType.name() + ".");
        return explicitThread;
    }

    boolean isSessionImport = "session".equalsIgnoreCase(item.sourceType());
    String title = item.title() == null || item.title().isBlank()
            ? providerType.name() + " " + item.sourceType() + " session"
            : item.title();

    if (!isSessionImport) {
        // Legacy aggregate path retains the title-merge behavior.
        if (item.projectKey() != null && !item.projectKey().isBlank()) {
            Thread sameProjectAndTitle = threadRepository
                    .findTopByProjectKeyIgnoreCaseAndTitleIgnoreCaseAndStatusOrderByLastActivityAtDesc(
                            item.projectKey(), title, ThreadStatus.ACTIVE);
            if (sameProjectAndTitle != null) {
                sameProjectAndTitle.touch("Review linked import for " + providerType.name() + ".");
                return sameProjectAndTitle;
            }
        }
        Thread existingByTitle = threadRepository.findTopByTitleIgnoreCaseAndStatusOrderByLastActivityAtDesc(
                title, ThreadStatus.ACTIVE);
        if (existingByTitle != null) {
            existingByTitle.touch("Review linked import for " + providerType.name() + ".");
            return existingByTitle;
        }
    }

    return threadRepository.save(new Thread(
            item.projectKey() == null || item.projectKey().isBlank()
                    ? "imported-" + providerType.name().toLowerCase()
                    : item.projectKey(),
            title,
            ThreadPriority.MEDIUM,
            "Imported from " + providerType.name() + " " + item.sourceType() + ".",
            "Review imported context and set next action.",
            "Thread is classified and linked to a concrete task."
    ));
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.provider.application.ProviderConnectionServiceOneToOneTest'`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `cd threadkeeper-api && ./gradlew test`
Expected: PASS (existing ProviderImportMergeTest continues to pass — it uses non-session sourceType).

- [ ] **Step 6: Commit**

```bash
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/application/ProviderConnectionService.java threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/application/ProviderConnectionServiceOneToOneTest.java
git commit -m "Force 1:1 thread-per-session for Codex session imports"
```

---

### Task 22: Refresh path — keeps originalIntent, advances nextAction + lastActivity

**Files:**
- Modify: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/application/ProviderConnectionServiceRichFieldTest.java` (append a second test) OR new file.

- [ ] **Step 1: Append failing test**

```java
@Test
void refreshKeepsOriginalIntentAndAdvancesNextActionAndLastActivity() {
    BridgeImportPayload first = new BridgeImportPayload(
            "2026-05-30T00:00:00Z", List.of("CODEX"),
            List.of(new BridgeImportPayload.SourceSessionPayload(
                    "CODEX", "session-X", "session", "/p/x.jsonl",
                    "Title v1", "2026-05-30T00:00:00Z", "{}",
                    "2026-05-01T10:00:00Z", "2026-05-01T10:30:00Z",
                    "example-api", "ORIGINAL intent", "old next")));
    when(bridgeImportClient.runImport(any(RunProviderImportRequest.class))).thenReturn(first);
    service.runImport(connectionId, new RunProviderImportRequest("/u","/u","full","codex",false));

    // Second run with grown session
    BridgeImportPayload second = new BridgeImportPayload(
            "2026-05-30T01:00:00Z", List.of("CODEX"),
            List.of(new BridgeImportPayload.SourceSessionPayload(
                    "CODEX", "session-X", "session", "/p/x.jsonl",
                    "Title v2", "2026-05-30T01:00:00Z", "{}",
                    "2026-05-01T10:00:00Z", "2026-05-02T12:00:00Z",
                    "example-api", "DIFFERENT intent attempt", "NEW next")));
    when(bridgeImportClient.runImport(any(RunProviderImportRequest.class))).thenReturn(second);
    service.runImport(connectionId, new RunProviderImportRequest("/u","/u","full","codex",false));

    SourceSession s = sourceSessionRepository
            .findByProviderConnectionIdAndProviderSessionKey(connectionId, "session-X").orElseThrow();
    Thread thread = s.getThread();
    assertThat(thread.getOriginalIntent()).isEqualTo("ORIGINAL intent"); // unchanged
    assertThat(thread.getCurrentNextAction()).isEqualTo("NEW next");
    assertThat(thread.getLastActivityAt().toString()).isEqualTo("2026-05-02T12:00:00Z");
    assertThat(s.getLastActivityAt().toString()).isEqualTo("2026-05-02T12:00:00Z");
}
```

- [ ] **Step 2: Run test, expect pass (Task 20 already wired refresh correctly)**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.provider.application.ProviderConnectionServiceRichFieldTest'`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/application/ProviderConnectionServiceRichFieldTest.java
git commit -m "Regression test: refresh keeps originalIntent, advances nextAction"
```

---

## Phase 7 — Reset endpoint

### Task 23: Repository support — find/delete by provider connection

**Files:**
- Modify: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/source/domain/SourceSessionRepository.java`
- Modify: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/snapshot/domain/ThreadSnapshotRepository.java`
- Modify: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/thread/domain/ThreadRepository.java`

- [ ] **Step 1: Edit repositories**

```java
// SourceSessionRepository.java — add:
List<SourceSession> findAllByProviderConnectionId(Long providerConnectionId);
long countByThreadIdAndProviderConnectionIdNot(Long threadId, Long providerConnectionId);
void deleteAllByProviderConnectionId(Long providerConnectionId);
```

```java
// ThreadSnapshotRepository.java — add:
@org.springframework.data.jpa.repository.Modifying
@org.springframework.transaction.annotation.Transactional
void deleteAllByThreadIdIn(java.util.Collection<Long> threadIds);
```

```java
// ThreadRepository.java — add:
@org.springframework.data.jpa.repository.Modifying
@org.springframework.transaction.annotation.Transactional
void deleteAllByIdIn(java.util.Collection<Long> ids);
```

- [ ] **Step 2: Compile check**

Run: `cd threadkeeper-api && ./gradlew compileJava`
Expected: SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/source/domain/SourceSessionRepository.java threadkeeper-api/src/main/java/com/jean325/threadkeeper/snapshot/domain/ThreadSnapshotRepository.java threadkeeper-api/src/main/java/com/jean325/threadkeeper/thread/domain/ThreadRepository.java
git commit -m "Add repository methods for scoped import reset"
```

---

### Task 24: `resetConnectionImports` service + response DTO

**Files:**
- Create: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/dto/ResetConnectionImportsResponse.java`
- Modify: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/application/ProviderConnectionService.java`
- Create: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/application/ProviderConnectionResetServiceTest.java`

- [ ] **Step 1: Create DTO**

```java
// ResetConnectionImportsResponse.java
package com.jean325.threadkeeper.provider.dto;

public record ResetConnectionImportsResponse(
        long threadsDeleted,
        long sourceSessionsDeleted,
        long snapshotsDeleted
) {}
```

- [ ] **Step 2: Write failing service test**

```java
// ProviderConnectionResetServiceTest.java
package com.jean325.threadkeeper.provider.application;

import com.jean325.threadkeeper.provider.domain.ProviderType;
import com.jean325.threadkeeper.provider.dto.*;
import com.jean325.threadkeeper.snapshot.domain.ThreadSnapshotRepository;
import com.jean325.threadkeeper.source.domain.SourceSessionRepository;
import com.jean325.threadkeeper.thread.domain.Thread;
import com.jean325.threadkeeper.thread.domain.ThreadPriority;
import com.jean325.threadkeeper.thread.domain.ThreadRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class ProviderConnectionResetServiceTest {

    @Autowired ProviderConnectionService service;
    @Autowired SourceSessionRepository sourceSessionRepository;
    @Autowired ThreadSnapshotRepository threadSnapshotRepository;
    @Autowired ThreadRepository threadRepository;

    @Test
    void resetDeletesCodexImportsAndPreservesClaudeAndManual() {
        Long codexId = service.createConnection(
                new CreateProviderConnectionRequest(ProviderType.CODEX, "codex", null)).id();
        Long claudeId = service.createConnection(
                new CreateProviderConnectionRequest(ProviderType.CLAUDE, "claude", null)).id();

        // CODEX session
        service.importSourceSessions(codexId, new ImportSourceSessionsRequest("full", false,
                List.of(new ImportSourceSessionsRequest.SourceSessionImportRequest(
                        null, "p", "CODEX", "codex-1", "session", "/p/a.jsonl",
                        "t1", "{}", "i1", "n1", null, null))));
        // CLAUDE session
        service.importSourceSessions(claudeId, new ImportSourceSessionsRequest("full", false,
                List.of(new ImportSourceSessionsRequest.SourceSessionImportRequest(
                        null, "p", "CLAUDE", "claude-1", "session", "/p/b.json",
                        "t2", "{}", "i2", "n2", null, null))));
        // Manual thread (no source session)
        Thread manual = threadRepository.save(new Thread(
                "manual", "manual-title", ThreadPriority.MEDIUM, "intent", "g", "done"));

        ResetConnectionImportsResponse result = service.resetConnectionImports(codexId);

        assertThat(result.sourceSessionsDeleted()).isEqualTo(1);
        assertThat(result.threadsDeleted()).isEqualTo(1);
        assertThat(result.snapshotsDeleted()).isGreaterThanOrEqualTo(1);
        assertThat(sourceSessionRepository.findByProviderConnectionIdAndProviderSessionKey(codexId, "codex-1")).isEmpty();
        assertThat(sourceSessionRepository.findByProviderConnectionIdAndProviderSessionKey(claudeId, "claude-1")).isPresent();
        assertThat(threadRepository.findById(manual.getId())).isPresent();
    }
}
```

- [ ] **Step 3: Run test, expect failure**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.provider.application.ProviderConnectionResetServiceTest'`
Expected: FAIL — `resetConnectionImports` not implemented.

- [ ] **Step 4: Implement service method**

```java
// In ProviderConnectionService.java
@Transactional
public ResetConnectionImportsResponse resetConnectionImports(Long connectionId) {
    ProviderConnection connection = providerConnectionRepository.findById(connectionId).orElseThrow();

    List<SourceSession> sessions = sourceSessionRepository.findAllByProviderConnectionId(connectionId);

    // Collect distinct thread ids whose only remaining source sessions belong to this connection.
    List<Long> candidateThreadIds = sessions.stream()
            .map(s -> s.getThread().getId())
            .distinct()
            .toList();

    List<Long> threadsToDelete = candidateThreadIds.stream()
            .filter(tid -> sourceSessionRepository
                    .countByThreadIdAndProviderConnectionIdNot(tid, connectionId) == 0)
            .toList();

    // 1) Delete snapshots for those threads
    long snapshotsDeleted = 0;
    if (!threadsToDelete.isEmpty()) {
        long before = threadSnapshotRepository.count();
        threadSnapshotRepository.deleteAllByThreadIdIn(threadsToDelete);
        snapshotsDeleted = before - threadSnapshotRepository.count();
    }
    // 2) Delete source sessions for this connection
    long sourceSessionsDeleted = sessions.size();
    sourceSessionRepository.deleteAllByProviderConnectionId(connectionId);
    // 3) Delete threads with no surviving source sessions
    long threadsDeleted = 0;
    if (!threadsToDelete.isEmpty()) {
        threadRepository.deleteAllByIdIn(threadsToDelete);
        threadsDeleted = threadsToDelete.size();
    }

    return new ResetConnectionImportsResponse(threadsDeleted, sourceSessionsDeleted, snapshotsDeleted);
}
```

- [ ] **Step 5: Run test, expect pass**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.provider.application.ProviderConnectionResetServiceTest'`
Expected: PASS.

- [ ] **Step 6: Run full suite**

Run: `cd threadkeeper-api && ./gradlew test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/dto/ResetConnectionImportsResponse.java threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/application/ProviderConnectionService.java threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/application/ProviderConnectionResetServiceTest.java
git commit -m "Add scoped resetConnectionImports service"
```

---

### Task 25: Reset endpoint `DELETE /api/v1/provider-connections/{id}/imports`

**Files:**
- Modify: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/api/ProviderConnectionController.java`
- Create: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/api/ProviderConnectionResetControllerTest.java`

- [ ] **Step 1: Write failing test**

```java
// ProviderConnectionResetControllerTest.java
package com.jean325.threadkeeper.provider.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jean325.threadkeeper.provider.application.ProviderConnectionService;
import com.jean325.threadkeeper.provider.dto.ResetConnectionImportsResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ProviderConnectionController.class)
class ProviderConnectionResetControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper mapper;
    @MockBean ProviderConnectionService service;

    @Test
    void deleteEndpointReturnsCounts() throws Exception {
        when(service.resetConnectionImports(eq(1L)))
                .thenReturn(new ResetConnectionImportsResponse(29, 29, 30));

        mockMvc.perform(delete("/api/v1/provider-connections/1/imports"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.threadsDeleted").value(29))
                .andExpect(jsonPath("$.sourceSessionsDeleted").value(29))
                .andExpect(jsonPath("$.snapshotsDeleted").value(30));
    }
}
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.provider.api.ProviderConnectionResetControllerTest'`
Expected: FAIL — endpoint not present.

- [ ] **Step 3: Add endpoint**

```java
// ProviderConnectionController.java — add method
@org.springframework.web.bind.annotation.DeleteMapping("/{connectionId}/imports")
public com.jean325.threadkeeper.provider.dto.ResetConnectionImportsResponse resetImports(
        @org.springframework.web.bind.annotation.PathVariable Long connectionId) {
    return providerConnectionService.resetConnectionImports(connectionId);
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd threadkeeper-api && ./gradlew test --tests 'com.jean325.threadkeeper.provider.api.ProviderConnectionResetControllerTest'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/api/ProviderConnectionController.java threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/api/ProviderConnectionResetControllerTest.java
git commit -m "Expose DELETE /provider-connections/{id}/imports endpoint"
```

---

## Phase 8 — End-to-end verification (manual)

### Task 26: Manual end-to-end run + acceptance checks

**Files:** none (runbook only). Capture results in a short note appended to the spec if useful.

- [ ] **Step 1: Restart API + bridge**

Restart `threadkeeper-api` (the launchd service from the handoff) so the new code takes effect. Confirm the bridge dir has the new files:
```bash
ls /Users/jean325/portfolio/projects/threadkeeper/agent-state-migrator-bridge/src/codex-enumerator.js
```

- [ ] **Step 2: Reset the CODEX connection (id=1)**

```bash
curl -sX DELETE http://localhost:8080/api/v1/provider-connections/1/imports
```
Expected JSON like `{"threadsDeleted":29,"sourceSessionsDeleted":29,"snapshotsDeleted":<n>}`.

Verify in Postgres:
```bash
docker exec -i threadkeeper-postgres psql -U threadkeeper -d threadkeeper -c \
  "SELECT count(*) FROM source_sessions WHERE provider_connection_id = 1;"
```
Expected: `0`.

- [ ] **Step 3: Run the new session-level import**

```bash
curl -sX POST http://localhost:8080/api/v1/provider-connections/1/imports/run \
  -H "Content-Type: application/json" \
  -d '{
    "bridgePath": "/Users/jean325/portfolio/projects/threadkeeper/agent-state-migrator-bridge",
    "migratorPath": "/Users/jean325/IdeaProjects/company/tixpass/agent-state-migrator",
    "profile": "full",
    "target": "codex",
    "includeSensitive": false
  }' | head -c 2000
```
Expected: a list of source-session responses, one per scanned rollout file. (Truncated by `head` to avoid surrogate flooding the terminal.)

- [ ] **Step 4: Verify thread count ≈ scanned file count**

```bash
find ~/.codex/sessions -name 'rollout-*.jsonl' -type f | wc -l
docker exec -i threadkeeper-postgres psql -U threadkeeper -d threadkeeper -c \
  "SELECT count(*) FROM source_sessions WHERE provider_connection_id = 1;"
docker exec -i threadkeeper-postgres psql -U threadkeeper -d threadkeeper -c \
  "SELECT count(DISTINCT thread_id) FROM source_sessions WHERE provider_connection_id = 1;"
```
Expected: source_sessions count ≈ rollout file count (minus skipped); distinct thread count = source_sessions count (1:1).

- [ ] **Step 5: Spot-check rich fields without dumping bodies**

```bash
docker exec -i threadkeeper-postgres psql -U threadkeeper -d threadkeeper -c \
  "SELECT project_key, length(original_intent) AS intent_len, length(current_next_action) AS next_len, last_activity_at
     FROM threads
    WHERE id IN (SELECT thread_id FROM source_sessions WHERE provider_connection_id = 1)
    ORDER BY last_activity_at DESC
    LIMIT 5;"
```
Expected: non-zero `intent_len` and `next_len`, varied `project_key` values, `last_activity_at` distributed across session dates.

- [ ] **Step 6: Idempotency — run import again, confirm no new threads**

```bash
COUNT_BEFORE=$(docker exec -i threadkeeper-postgres psql -tA -U threadkeeper -d threadkeeper -c \
  "SELECT count(*) FROM threads WHERE id IN (SELECT thread_id FROM source_sessions WHERE provider_connection_id = 1);")
curl -sX POST http://localhost:8080/api/v1/provider-connections/1/imports/run \
  -H "Content-Type: application/json" \
  -d '{"bridgePath":"...","migratorPath":"...","target":"codex"}' > /dev/null
COUNT_AFTER=$(docker exec -i threadkeeper-postgres psql -tA -U threadkeeper -d threadkeeper -c \
  "SELECT count(*) FROM threads WHERE id IN (SELECT thread_id FROM source_sessions WHERE provider_connection_id = 1);")
echo "before=$COUNT_BEFORE after=$COUNT_AFTER"
```
Expected: `before == after`.

- [ ] **Step 7: Record acceptance results (commit short note)**

If useful, append a small `## Acceptance run` section to the spec with the observed counts, then:

```bash
git add docs/superpowers/specs/2026-05-28-threadkeeper-session-ingestion-design.md
git commit -m "Record acceptance run results for session-level Codex ingestion"
```

---

## Self-Review (run after writing the plan above)

Spec coverage check against `docs/superpowers/specs/2026-05-28-threadkeeper-session-ingestion-design.md`:

| Spec section/requirement | Tasks |
|---|---|
| §3 Architecture: bridge enumerator + thin API mapper | Tasks 4–15 (bridge), 16–22 (API) |
| §4 Field derivation (providerSessionKey/sourcePath/sourceType/provider/startedAt/projectKey) | Task 4 |
| §4 originalIntent rule (first event_msg/user_message) | Task 5 |
| §4 nextAction rule + fallback + null | Task 6 |
| §4 lastActivityAt from last line | Task 7 |
| §4 title rule + fallback | Task 8 |
| §4 Safe decoding pipeline (surrogate, control, NFC, code-point truncate) | Tasks 1–3 (primitives), 11 (regression) |
| §4 File-level failure isolation + summary | Tasks 9, 10, 13 |
| §5 DTO additions (BridgeImportPayload, ImportSourceSessionsRequest) | Tasks 16–17 |
| §5 SourceSession startedAt/lastActivityAt | Task 18 |
| §5 Thread.applyImportedSession | Task 19 |
| §5 1:1 guarantee (disable title-merge for session imports) | Task 21 |
| §5 Refresh: update SourceSession + Thread.nextAction/lastActivity, keep originalIntent | Tasks 20, 22 |
| §6 Reset endpoint + scoped delete + guard | Tasks 23–25 |
| §7 Idempotency (full scan + dedup/refresh) | Tasks 14, 22; manual Step 6 (Task 26) |
| §8 Error handling: per-file/line isolation, ApiException retained | Tasks 9, 10, 13; (existing ApiException untouched) |
| §9 Testing: bridge fixtures + surrogate regression + Java service/controller tests | Tasks 4–13 (bridge), 18–25 (Java) |
| §11 Acceptance criteria | Task 26 (manual E2E) |

No spec requirements without a corresponding task.

Placeholder scan: searched for "TBD", "TODO", "add appropriate", "similar to" — none present. Every step shows the actual code or command.

Type/name consistency: `SourceSessionPayload` extra fields, `SourceSessionImportRequest` extra fields, `applyImportedSession(originalIntent, currentNextAction, lastActivityAt)` and `Thread.touch` are referenced consistently across Tasks 16–22. `ResetConnectionImportsResponse(threadsDeleted, sourceSessionsDeleted, snapshotsDeleted)` is created in Task 24 and consumed identically in Tasks 24–25.
