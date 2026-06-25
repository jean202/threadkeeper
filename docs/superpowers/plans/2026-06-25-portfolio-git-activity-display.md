# Portfolio git-activity read-only display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each project's git activity (last-commit age + active flag) from portfolio-tracker's `scan-result.json` next to the existing ThreadKeeper portfolio readiness badge, read-only.

**Architecture:** Extend the EXISTING `scan-result.json → PortfolioScanFileReader → PortfolioReadinessService → GET /api/v1/portfolio-readiness → web badge` pipeline by threading three display-only fields through each layer. The fields NEVER affect `readiness` — they are carried straight through, eliminating any PT-readiness ⇄ TK loop. No new endpoint, fetch, or file read.

**Tech Stack:** Java 21 / Spring Boot (api, JUnit5 + AssertJ), Next.js 16 / React 19 / TypeScript (web, no test runner present).

**Spec:** `docs/superpowers/specs/2026-06-25-portfolio-git-activity-display-design.md`

---

## File Structure

**Backend (threadkeeper-api):**
- `.../portfolio/application/PortfolioScanEntry.java` — add nested `GitActivity` record + back-compat 4-arg constructor
- `.../portfolio/application/PortfolioScanFileReader.java` — parse `activity` object from JSON
- `.../portfolio/dto/PortfolioReadinessResponse.java` — add 3 display fields
- `.../portfolio/application/PortfolioReadinessService.java` — map gitActivity → response (readiness untouched)
- Tests: `PortfolioScanFileReaderTest.java`, `PortfolioReadinessServiceTest.java` (add cases)

**Web (threadkeeper-web):**
- `src/types/portfolio.ts` — add 3 fields
- `src/components/PortfolioReadinessBadge.tsx` — add pure formatters + render git activity

All paths below are relative to the repo root unless noted.

---

### Task 1: Extend `PortfolioScanEntry` with `GitActivity` (back-compat)

**Files:**
- Modify: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/application/PortfolioScanEntry.java`

This is a structural change first so later tests compile. The 4-arg convenience constructor keeps existing `new PortfolioScanEntry(name, readiness, baseReadiness, scannedAt)` call sites (in `PortfolioReadinessServiceTest`) compiling unchanged.

- [ ] **Step 1: Replace the record with the extended version**

```java
package com.jean325.threadkeeper.portfolio.application;

public record PortfolioScanEntry(
        String name, int readiness, int baseReadiness, String scannedAt, GitActivity gitActivity) {

    /** Back-compat: entries without git activity. */
    public PortfolioScanEntry(String name, int readiness, int baseReadiness, String scannedAt) {
        this(name, readiness, baseReadiness, scannedAt, null);
    }

    public record GitActivity(Integer daysSinceLastCommit, boolean active, String lastCommitDate) {}
}
```

- [ ] **Step 2: Compile to verify nothing breaks**

Run: `cd threadkeeper-api && ./gradlew compileJava compileTestJava`
Expected: BUILD SUCCESSFUL (existing 4-arg call sites still compile via the convenience constructor).

- [ ] **Step 3: Commit**

```bash
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/application/PortfolioScanEntry.java
git commit -m "feat: add GitActivity to PortfolioScanEntry (back-compat ctor)"
```

---

### Task 2: Parse `activity` in `PortfolioScanFileReader`

**Files:**
- Modify: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/application/PortfolioScanFileReader.java`
- Test: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/portfolio/application/PortfolioScanFileReaderTest.java`

- [ ] **Step 1: Write the failing tests**

Append these tests to `PortfolioScanFileReaderTest` (uses the existing `@TempDir tempDir` and `readerFor(...)` helper):

```java
    @Test
    void parsesGitActivityWhenPresent() throws Exception {
        Path file = tempDir.resolve("scan-activity.json");
        Files.writeString(file, """
                {"projects":[
                  {"name":"discord-kakao-translator","readiness":80,"baseReadiness":80,
                   "scannedAt":"2026-06-25T00:11:33.628Z",
                   "activity":{"lastCommitDate":"2026-04-09T10:08:44.000Z",
                               "daysSinceLastCommit":76,"isActive":false}}
                ]}
                """);
        PortfolioScanEntry.GitActivity git = readerFor(file).read().get(0).gitActivity();
        assertThat(git).isNotNull();
        assertThat(git.daysSinceLastCommit()).isEqualTo(76);
        assertThat(git.active()).isFalse();
        assertThat(git.lastCommitDate()).isEqualTo("2026-04-09T10:08:44.000Z");
    }

    @Test
    void gitActivityNullWhenActivityAbsent() throws Exception {
        Path file = tempDir.resolve("scan-no-activity.json");
        Files.writeString(file, """
                {"projects":[
                  {"name":"a","readiness":10,"baseReadiness":10,"scannedAt":"2026-06-02T00:00:00Z"}
                ]}
                """);
        assertThat(readerFor(file).read().get(0).gitActivity()).isNull();
    }

    @Test
    void gitActivityToleratesMissingSubFields() throws Exception {
        Path file = tempDir.resolve("scan-partial.json");
        Files.writeString(file, """
                {"projects":[
                  {"name":"a","readiness":10,"baseReadiness":10,"scannedAt":"2026-06-02T00:00:00Z",
                   "activity":{"isActive":true}}
                ]}
                """);
        PortfolioScanEntry.GitActivity git = readerFor(file).read().get(0).gitActivity();
        assertThat(git).isNotNull();
        assertThat(git.daysSinceLastCommit()).isNull();
        assertThat(git.active()).isTrue();
        assertThat(git.lastCommitDate()).isNull();
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd threadkeeper-api && ./gradlew test --tests "*PortfolioScanFileReaderTest"`
Expected: FAIL — `gitActivity()` is null because `parse()` does not read `activity` yet (the present/partial cases fail their assertions).

- [ ] **Step 3: Implement parsing in `parse()`**

In `PortfolioScanFileReader.parse()`, replace the loop body that builds each entry. Current:

```java
                int readiness = project.path("readiness").asInt(0);
                int baseReadiness = project.path("baseReadiness").asInt(readiness);
                String scannedAt = project.path("scannedAt").asText(null);
                entries.add(new PortfolioScanEntry(name, readiness, baseReadiness, scannedAt));
```

Replace with:

```java
                int readiness = project.path("readiness").asInt(0);
                int baseReadiness = project.path("baseReadiness").asInt(readiness);
                String scannedAt = project.path("scannedAt").asText(null);
                entries.add(new PortfolioScanEntry(
                        name, readiness, baseReadiness, scannedAt, parseGitActivity(project.path("activity"))));
```

Add this private helper to the class:

```java
    private PortfolioScanEntry.GitActivity parseGitActivity(JsonNode activity) {
        if (!activity.isObject()) {
            return null;
        }
        JsonNode daysNode = activity.path("daysSinceLastCommit");
        Integer days = daysNode.isNumber() ? daysNode.asInt() : null;
        boolean active = activity.path("isActive").asBoolean(false);
        String lastCommitDate = activity.path("lastCommitDate").asText(null);
        return new PortfolioScanEntry.GitActivity(days, active, lastCommitDate);
    }
```

(`JsonNode` is already imported in this file.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd threadkeeper-api && ./gradlew test --tests "*PortfolioScanFileReaderTest"`
Expected: PASS (all cases, including the 5 pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/application/PortfolioScanFileReader.java \
        threadkeeper-api/src/test/java/com/jean325/threadkeeper/portfolio/application/PortfolioScanFileReaderTest.java
git commit -m "feat: parse git activity from scan-result.json"
```

---

### Task 3: Carry git fields through `PortfolioReadinessResponse` + service

**Files:**
- Modify: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/dto/PortfolioReadinessResponse.java`
- Modify: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/application/PortfolioReadinessService.java`
- Test: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/portfolio/application/PortfolioReadinessServiceTest.java`

- [ ] **Step 1: Add fields to the response record + add the failing test, with service passing nulls (compiles, red)**

Replace `PortfolioReadinessResponse.java` with:

```java
package com.jean325.threadkeeper.portfolio.dto;

import java.time.Instant;

public record PortfolioReadinessResponse(
        String projectKey,
        int readiness,
        int baseReadiness,
        Instant scannedAt,
        boolean stale,
        long ageDays,
        Integer daysSinceLastCommit,
        Boolean active,
        Instant lastCommitDate
) {
}
```

In `PortfolioReadinessService.listReadiness()`, the existing `new PortfolioReadinessResponse(...)` now needs 3 more args. Temporarily pass nulls so it compiles (real mapping comes in Step 3). Change:

```java
            result.add(new PortfolioReadinessResponse(
                    projectKey,
                    entry.readiness(),
                    entry.baseReadiness(),
                    scannedAt,
                    stale,
                    ageDays
            ));
```

to:

```java
            result.add(new PortfolioReadinessResponse(
                    projectKey,
                    entry.readiness(),
                    entry.baseReadiness(),
                    scannedAt,
                    stale,
                    ageDays,
                    null,
                    null,
                    null
            ));
```

Append this test to `PortfolioReadinessServiceTest`:

```java
    @Test
    void mapsGitActivityIntoResponse() {
        var service = serviceWith(true, 14, List.of(
                new PortfolioScanEntry("a", 80, 80, "2026-06-03T00:00:00Z",
                        new PortfolioScanEntry.GitActivity(76, true, "2026-04-09T10:08:44.000Z"))));
        var r = service.listReadiness().get(0);
        assertThat(r.daysSinceLastCommit()).isEqualTo(76);
        assertThat(r.active()).isTrue();
        assertThat(r.lastCommitDate()).isEqualTo(Instant.parse("2026-04-09T10:08:44.000Z"));
        // readiness must be unaffected by git activity
        assertThat(r.readiness()).isEqualTo(80);
    }

    @Test
    void gitFieldsNullWhenNoGitActivity() {
        var service = serviceWith(true, 14, List.of(
                new PortfolioScanEntry("a", 50, 50, "2026-06-03T00:00:00Z")));
        var r = service.listReadiness().get(0);
        assertThat(r.daysSinceLastCommit()).isNull();
        assertThat(r.active()).isNull();
        assertThat(r.lastCommitDate()).isNull();
    }
```

- [ ] **Step 2: Run tests to verify the new mapping test fails**

Run: `cd threadkeeper-api && ./gradlew test --tests "*PortfolioReadinessServiceTest"`
Expected: `mapsGitActivityIntoResponse` FAILS (service passes null, expected 76). `gitFieldsNullWhenNoGitActivity` already passes.

- [ ] **Step 3: Implement the real mapping**

In `PortfolioReadinessService.listReadiness()`, inside the for-loop before building the response, compute the git fields, and use them in the constructor:

```java
            PortfolioScanEntry.GitActivity git = entry.gitActivity();
            Integer daysSinceLastCommit = git == null ? null : git.daysSinceLastCommit();
            Boolean active = git == null ? null : git.active();
            Instant lastCommitDate = git == null ? null : parseInstant(git.lastCommitDate());
            result.add(new PortfolioReadinessResponse(
                    projectKey,
                    entry.readiness(),
                    entry.baseReadiness(),
                    scannedAt,
                    stale,
                    ageDays,
                    daysSinceLastCommit,
                    active,
                    lastCommitDate
            ));
```

(`PortfolioScanEntry`, `Instant`, and `parseInstant` are already available in this file.)

- [ ] **Step 4: Run the full backend suite to verify green**

Run: `cd threadkeeper-api && ./gradlew test`
Expected: BUILD SUCCESSFUL, all tests pass (including `PortfolioReadinessControllerTest`, unaffected since it asserts only existing fields).

- [ ] **Step 5: Commit**

```bash
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/dto/PortfolioReadinessResponse.java \
        threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/application/PortfolioReadinessService.java \
        threadkeeper-api/src/test/java/com/jean325/threadkeeper/portfolio/application/PortfolioReadinessServiceTest.java
git commit -m "feat: expose git activity in portfolio-readiness response"
```

---

### Task 4: Web — types + badge display

**Files:**
- Modify: `threadkeeper-web/src/types/portfolio.ts`
- Modify: `threadkeeper-web/src/components/PortfolioReadinessBadge.tsx`

No test runner exists in threadkeeper-web; verification is `tsc` type-check + the manual check in Task 5. Display logic is isolated into pure functions so it is obvious and could be unit-tested later if a runner is added.

- [ ] **Step 1: Add fields to the type**

Replace `src/types/portfolio.ts` with:

```ts
export interface PortfolioReadiness {
  projectKey: string;
  readiness: number;
  baseReadiness: number;
  scannedAt: string | null;
  stale: boolean;
  ageDays: number;
  daysSinceLastCommit: number | null;
  active: boolean | null;
  lastCommitDate: string | null;
}
```

- [ ] **Step 2: Add pure formatters + render git activity in the badge**

Replace `src/components/PortfolioReadinessBadge.tsx` with:

```tsx
import { PortfolioReadiness } from '@/types/portfolio';

function formatAge(ageDays: number): string {
  if (ageDays < 0) return '';
  if (ageDays === 0) return '오늘';
  return `${ageDays}일 전`;
}

// Days since last git commit. Labelled "커밋" to avoid confusion with scan age above.
export function formatCommitAge(days: number | null): string {
  if (days === null || days < 0) return '';
  if (days === 0) return '커밋 오늘';
  return `커밋 ${days}일 전`;
}

// 🟢 active (commits in last 7 days), ⚪ inactive, '' when unknown.
export function activityDot(active: boolean | null): string {
  if (active === null) return '';
  return active ? '🟢' : '⚪';
}

export default function PortfolioReadinessBadge({ readiness }: { readiness?: PortfolioReadiness }) {
  if (!readiness) return null;

  const age = formatAge(readiness.ageDays);
  const label = age ? `${readiness.readiness}% · ${age}` : `${readiness.readiness}%`;

  const commitAge = formatCommitAge(readiness.daysSinceLastCommit);
  const dot = activityDot(readiness.active);
  const gitPart = [commitAge, dot].filter(Boolean).join(' ');

  const title = readiness.lastCommitDate
    ? `portfolio-tracker · 마지막 커밋 ${readiness.lastCommitDate}`
    : 'portfolio-tracker';

  return (
    <span
      title={title}
      style={{
        marginLeft: '8px',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '12px',
        border: '1px solid #ccc',
        opacity: readiness.stale ? 0.5 : 1,
      }}
    >
      포트폴리오 {label}
      {gitPart ? ` · ${gitPart}` : ''}
      {readiness.stale ? ' (stale)' : ''}
    </span>
  );
}
```

- [ ] **Step 3: Type-check the web app**

Run: `cd threadkeeper-web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add threadkeeper-web/src/types/portfolio.ts threadkeeper-web/src/components/PortfolioReadinessBadge.tsx
git commit -m "feat: show git activity in portfolio readiness badge"
```

---

### Task 5: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm portfolio integration is enabled in api config**

Run: `grep -n -A4 "portfolio" threadkeeper-api/src/main/resources/application.yml`
Expected: a `portfolio` block with `enabled: true` and a `json-path` pointing at a `scan-result.json`. If `enabled` is false or `json-path` is empty, note it — the badge git part will be absent until configured (do not change config as part of this feature unless the user asks).

- [ ] **Step 2: Verify the API returns git fields**

With the api running (it is started by `scripts/start.sh` / the `com.threadkeeper.api` LaunchAgent), run:

Run: `curl -s http://localhost:8080/api/v1/portfolio-readiness | python3 -m json.tool | head -40`
Expected: entries include `daysSinceLastCommit`, `active`, `lastCommitDate` (values present for git-backed, name-matched projects; null otherwise).

- [ ] **Step 3: Visually confirm the badge**

Open `http://localhost:3000/` and find a thread whose `projectKey` matches a scanned project. The portfolio badge should read e.g. `포트폴리오 80% · 커밋 3일 전 🟢`, and hovering shows the exact last-commit date in the tooltip. Confirm the scan-age "N일 전" and the "커밋 N일 전" are visually distinct.

---

## Self-Review

**Spec coverage:**
- Data fields (daysSinceLastCommit, isActive, lastCommitDate) → Task 2 (parse) + Task 3 (response).
- Backend pass-through, readiness untouched → Task 3 (asserted by `mapsGitActivityIntoResponse`).
- Web type + badge with "커밋" disambiguation + active dot + tooltip → Task 4.
- Edge cases (no activity / partial / null) → Task 2 + Task 3 tests; web null-handling in `formatCommitAge`/`activityDot`.
- **Adjustment vs spec:** spec listed a "web Badge render test"; threadkeeper-web has NO test runner, so automated web tests are out (introducing vitest for one badge is YAGNI). Compensated by isolating display logic into exported pure functions (`formatCommitAge`, `activityDot`) + `tsc` type-check + Task 5 manual check. Backend keeps full TDD.

**Placeholder scan:** none — every code/test step shows complete content.

**Type consistency:** `PortfolioScanEntry.GitActivity(Integer, boolean, String)` used identically in Tasks 1–3; `PortfolioReadinessResponse` 9-arg shape consistent between Step 1 (nulls) and Step 3 (mapped); web `PortfolioReadiness` fields match the JSON the response produces (`daysSinceLastCommit`, `active`, `lastCommitDate`).
