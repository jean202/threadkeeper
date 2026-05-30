# ThreadKeeper Session-Level Ingestion Design

**Date:** 2026-05-28
**Scope (this spec):** Codex only. Claude Code is deferred to a follow-up spec using the same pattern.
**Status:** Approved for implementation planning.

## 1. Problem

ThreadKeeper's current ingestion treats the whole `~/.codex/sessions` directory as a single "item", which the bridge maps 1:1 to one `source_session`, which becomes one `thread`. The result of the prior import: 29 aggregate threads covering hundreds of real sessions.

The goal is the inverse: **one Codex rollout file = one source session = one thread**, with each thread carrying meaningful, per-session metadata (real first user prompt, last agent statement, project context, accurate timestamps).

## 2. Decisions (from brainstorming)

| # | Question | Decision |
|---|---|---|
| 1 | Metadata granularity per thread | **Rich.** Parse session bodies to extract `original_intent`, `next_action`, `title`, `project_key`, `started_at`, `last_activity_at`. Accept added complexity and runtime. |
| 2 | Existing 29 directory-aggregate threads | **Wipe & re-import.** Scoped reset of the CODEX provider connection's imports. |
| 3 | Where session-aware logic lives | **Extend the bridge** (`agent-state-migrator-bridge`). Pure Node, in-repo, format knowledge in one place. |
| 4 | Incremental import | **Full scan + dedup/refresh.** Bridge always walks all files; Java dedups by `providerSessionKey`. Active sessions get refreshed. |

Architectural approach: **A — Rich payload + thin API mapper.** Bridge emits typed rich fields in the canonical payload; API maps them onto existing DB columns. No new DB columns required.

## 3. Architecture & Data Flow

```
API runImport(CODEX)
  → ProcessBridgeImportClient: node src/cli.js ... --target codex
      → bridge: walk <codex-home>/sessions/**/rollout-*.jsonl
           per file:
             - read first line (session_meta) → id, cwd, started_at
             - scan body lines → original_intent, next_action, last_activity_at, title
             - safe-decode all extracted strings
        → canonical payload.sourceSessions[]  (rich typed fields)
  → ProcessBridgeImportClient.transformPayload (metadata→metadataJson; rich fields pass through)
  → ProviderConnectionService.runImport → importSourceSessions
      → dedup by (provider_connection_id, providerSessionKey)
        - new: create Thread 1:1 (no title-merge) + SourceSession with rich fields
        - existing: refresh SourceSession + Thread.currentNextAction/lastActivityAt
```

**Module boundaries:**

- **Bridge** is the only place that knows the Codex file format. Pure Node, no deps. Owns parsing, field derivation, and Unicode safe-decoding.
- **API** is a thin typed mapper. Never reads session files. Consumes the canonical payload and writes DB rows.
- **DB** schema unchanged. We populate existing columns more meaningfully.

**Provider extensibility:** the new Codex enumerator lives behind a `target`-keyed dispatch in the bridge so Claude Code can plug in next with a sibling enumerator.

## 4. Bridge: Parsing, Field Derivation, Safe Decoding

**File walk:** `<codex-home>/sessions/**/rollout-*.jsonl`. `codex-home` defaults to `~/.codex`; override from the provider connection's `homePath` if set.

**Per-file field derivation:**

| Canonical field | Source | Rule |
|---|---|---|
| `providerSessionKey` | `session_meta.payload.id` | rollout UUID. Stable identity for dedup/refresh. |
| `provider` | fixed | `"CODEX"` |
| `sourceType` | fixed | `"session"` |
| `sourcePath` | file path | absolute |
| `startedAt` | `session_meta.payload.timestamp` | ISO instant |
| `lastActivityAt` | **last line's** top-level `timestamp` | ISO instant |
| `projectKey` | `session_meta.payload.cwd` | `basename(cwd)`, lowercased & sanitized; `"unknown"` when cwd missing. Full cwd preserved in metadata. |
| `originalIntent` | **first `event_msg`/`user_message`** | the real typed user prompt. (Injected context arrives as `response_item`/message role=user and is naturally excluded.) |
| `nextAction` | **last `event_msg`/`agent_message`**, fallback last `user_message` | heuristic — captures "what the agent last said it'd do." |
| `title` | first ~80 chars of `originalIntent`, single-line | fallback `"{projectKey} session {YYYY-MM-DD}"` |

**Codex line-type reference (observed):**
`session_meta` (1 line, first) · `event_msg`/{`user_message`,`agent_message`,`agent_reasoning`,`token_count`} · `response_item`/{`message` role user/assistant, `reasoning`, `function_call`, `function_call_output`} · `turn_context`.

**Safe decoding — applied to every extracted string** (must prevent the lone-surrogate crash that killed a prior session):

1. Read file as UTF-8; per-line `JSON.parse` in try/catch — malformed lines are skipped.
2. Sanitizer pipeline:
   1. Remove/replace unpaired surrogates (`\uD800`–`\uDFFF` without a valid pair).
   2. Strip control characters except `\n` and `\t`.
   3. NFC normalize.
3. Truncate at **code-point boundaries** (use `Array.from`/spread, not UTF-16 `slice`). Caps: `title ≤ 200`, `originalIntent`/`nextAction ≤ 4000`.
4. Emit via `JSON.stringify` only. **Never** print raw bodies to stdout/stderr/logs.

**File-level failure isolation:** missing `session_meta` or unrecoverable parse → skip file, increment a `warnings`/`skippedFiles` counter on the payload. One bad file never aborts the run.

## 5. API: DTO and Service Changes

No new DB columns. The plumbing carries new typed fields from bridge to existing columns.

**DTO additions:**

- `BridgeImportPayload.SourceSessionPayload` += `startedAt`, `lastActivityAt`, `projectKey`, `originalIntent`, `nextAction`
- `ImportSourceSessionsRequest.SourceSessionImportRequest` += `startedAt`, `lastActivityAt`, `originalIntent`, `nextAction` (`projectKey` already present)
- `ProviderConnectionService.runImport`: mapping passes the new fields through.

**SourceSession domain:**

- Constructor extended to accept `startedAt` and `lastActivityAt` (today: `startedAt` unset, `lastActivityAt = importedAt`).
- `refreshFromImport` extended to update `startedAt` (idempotent) and `lastActivityAt` from the session.

**Thread population on import** (`findOrCreateThreadForImport`):

- `projectKey`, `title` = extracted values.
- `originalIntent` = real first user prompt (replacing the current `"Imported from CODEX..."` placeholder).
- `currentNextAction` = extracted `nextAction`.
- `lastActivityAt` = session's real last activity (today this is always `Instant.now()`).
- Implementation: keep the public Thread constructor unchanged; add a domain method `Thread.applyImportedSession(originalIntent, nextAction, lastActivityAt)` invoked right after construction.

**Critical correctness — disable title-merge for session imports (1:1 guarantee):**

Today `findOrCreateThreadForImport` reuses an existing thread when title (or project+title) matches. With per-session ingestion this collapses genuinely-different sessions whose derived titles happen to match (common, since titles come from the first ~80 chars of a prompt, and fallback titles include the date+project). Two distinct sessions can mash into one thread.

Fix: for Codex session imports, **always create a new Thread per new SourceSession** (1:1). The auto title-merge is disabled on this path. Explicit `threadId` linking (manual case) remains.

Dedup is still correct: it runs **before** thread creation, keyed on `providerSessionKey` (the rollout UUID). Re-importing the same session id refreshes its existing thread; importing a new session always gets a new thread.

**Refresh path** (existing session imported again, e.g., continued conversation):

- Update SourceSession: `sourcePath`, `sourceType`, `title`, `startedAt`, `lastActivityAt`, `metadataJson`.
- Update Thread: `currentNextAction`, `lastActivityAt`.
- Keep Thread `originalIntent` stable — it's the *original* intent.

## 6. Wipe & Re-import: Scoped Reset Endpoint

The existing 29 directory-aggregate threads have providerSessionKeys (directory paths) that the new session-level import will never touch or refresh — they'd linger. They are removed via a scoped reset of the CODEX provider connection's imports.

**New operation: `ProviderConnectionService.resetConnectionImports(connectionId)`** — `@Transactional`, exposed as `DELETE /provider-connections/{id}/imports`.

Steps (FK order):

1. Find `source_sessions` where `provider_connection_id = {id}`; collect distinct `thread_id`s.
2. Delete `thread_snapshots` for those threads.
3. Delete those `source_sessions`.
4. Delete those threads, **guarded** by "thread has no remaining source_sessions" — protects threads shared with another provider connection (e.g., CLAUDE) or any thread that's also linked manually.

Scope guarantees: untouched are CLAUDE imports, manually-created threads, and any threads with surviving non-CODEX source sessions.

**Execution flow (this one time, and going forward when re-importing cleanly):**

```
DELETE /provider-connections/1/imports   # CODEX
POST   /provider-connections/1/runImport
```

Import is **not** auto-destructive — reset is a separate explicit call.

## 7. Incremental Import & Idempotency

- Bridge: stateless full scan every run. No cursor, no watermark. Mtime-based optimization is YAGNI right now; revisit if walk time becomes painful.
- API dedup keyed on `(provider_connection_id, providerSessionKey)`. New → 1:1 thread create. Existing → refresh.
- Refresh keeps `originalIntent` immutable but advances `currentNextAction` and `lastActivityAt` — useful for actively-growing sessions.
- Re-running import any number of times is idempotent; the only side effects on stable sessions are refreshed timestamps.

## 8. Error Handling

**Bridge:**

- Per-file try/catch — bad file is skipped and counted; one bad file does not abort the run.
- Per-line `JSON.parse` try/catch — bad lines skipped.
- Missing `session_meta` → no stable id, file skipped.
- Safe-decode sanitizer applied to every extracted string.
- Payload includes a small summary: `{ scanned, emitted, skippedFiles, warnings[] }`.

**API:**

- `ProcessBridgeImportClient` already maps non-zero bridge exit to `ApiException("BRIDGE_IMPORT_FAILED", ..., BAD_GATEWAY)` — retained.
- `runImport` and `resetConnectionImports` are `@Transactional`. Mid-flight failure rolls back, leaving DB consistent.
- Reset endpoint returns counts deleted (`{ threads, sourceSessions, snapshots }`).

## 9. Testing Strategy

**Bridge (`node --test`, existing `test/bridge.test.js`):**

- Unit tests on **small hand-crafted fixture jsonl files** committed under `test/fixtures/codex/`. Fixtures are not real session files — keeps suspect Unicode out of the regular dev loop.
- Cases: happy path; missing session_meta (skip); malformed line (skip+continue); empty cwd → `projectKey="unknown"`; title fallback when no user_message; `nextAction` fallback when no agent_message; long content truncated at code-point boundary; multiple user_messages → first wins; multiple agent_messages → last wins.
- **Surrogate fixture:** a file containing a lone unpaired surrogate in a message field — assert the sanitizer produces a clean string and the bridge completes the scan. This is the regression guard for the crash that motivated this work.

**API (Java, Spring tests):**

- Service: new session → 1:1 thread, no title-merge even when titles collide.
- Service: refresh updates `currentNextAction` and `lastActivityAt`, keeps `originalIntent`.
- Service: refresh sets `startedAt` idempotently.
- Reset service: deletes CODEX threads/sources/snapshots; preserves CLAUDE and manually-created threads.
- Reset service: thread shared with surviving non-CODEX source session is preserved.
- Controller: `DELETE /provider-connections/{id}/imports` returns deletion counts; auth/validation per existing conventions.

**Manual E2E:**

- `DELETE /provider-connections/1/imports` then `runImport` against real `~/.codex`.
- Verify thread count is roughly the file count (~254, minus skipped).
- Spot-check a handful of threads by querying DB for `title`, `original_intent`, `current_next_action` length — do not dump raw bodies into the conversation.

## 10. Out of Scope (future specs)

- **Claude Code ingestion.** `~/.claude/projects/<encoded-cwd>/<session-uuid>/` follows a different file layout. Will reuse the bridge's target-keyed dispatch and the same canonical payload contract; only a new enumerator + provider-specific extraction rules are needed.
- **Mtime watermark optimization** for the bridge file walk.
- **UI exposure of the reset endpoint** (callable from threadkeeper-web).
- **Snapshot inference** beyond the existing "Imported source session" snapshot — richer derived snapshots from session content.

## 11. Acceptance Criteria

1. After running `DELETE /provider-connections/{codex-id}/imports`, the 29 directory-aggregate threads and their source_sessions/snapshots are gone; CLAUDE and manual threads remain.
2. After running `runImport` on CODEX, the number of created threads equals the number of successfully-scanned rollout files (≈254 minus skipped/malformed); each thread corresponds 1:1 to one rollout file by `providerSessionKey`.
3. Spot-checked threads carry: a real `original_intent` (not a placeholder), a non-empty `current_next_action`, a `project_key` derived from cwd basename, `started_at` from session_meta, `last_activity_at` from the file's last line.
4. Running `runImport` a second time creates zero new threads; existing threads have `last_activity_at`/`current_next_action` advanced where the session grew, and unchanged `original_intent`.
5. The bridge unit-test suite includes and passes the lone-surrogate fixture case.
