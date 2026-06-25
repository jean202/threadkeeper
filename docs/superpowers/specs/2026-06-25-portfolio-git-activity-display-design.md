# Portfolio git-activity read-only display

**Date:** 2026-06-25
**Status:** Approved (brainstorm)
**Scope:** threadkeeper repo only (api + web). portfolio-tracker(PT) is NOT modified.

## Goal

Surface each project's **git activity** (from portfolio-tracker's `scan-result.json`)
in ThreadKeeper's web UI, **read-only, display only**. The data must NEVER feed back
into any score — specifically not into `readiness` — to avoid a circular
PT-readiness ⇄ TK loop. This is purely informational context shown next to the
existing portfolio readiness badge.

## Why this is safe (no new coupling)

A PT → TK read-only pipeline **already exists** and we only extend it:

```
PT scan-result.json (activity.* already present)
  └─▶ PortfolioScanFileReader.parse()   (mtime-cached)
        └─▶ PortfolioScanEntry → PortfolioReadinessService (stale calc)
              └─▶ PortfolioReadinessResponse → GET /api/v1/portfolio-readiness
                    └─▶ web: getPortfolioReadiness() → PortfolioReadinessBadge
```

We thread three additional **display-only** fields through these existing layers.
No new endpoint, no new file read, no new fetch, no new project-key matching.

## Data

PT already writes everything we need under each project's `activity` object in
`scan-result.json`; **PT requires no changes**. We consume exactly three fields:

| scan-result.json field          | meaning                          | UI use                       |
|----------------------------------|----------------------------------|------------------------------|
| `activity.daysSinceLastCommit`   | days since last commit (int)     | "커밋 N일 전"                |
| `activity.isActive`              | commits in last 7 days (bool)    | 🟢 active / ⚪ inactive dot   |
| `activity.lastCommitDate`        | ISO timestamp of last commit     | badge hover (title) tooltip  |

All three are optional: a project without git (`activity` absent) yields no
git-activity data and the UI silently omits that part.

## Backend changes (Java, display-only pass-through)

1. **`PortfolioScanEntry`** — add a nullable nested record:
   ```java
   public record GitActivity(Integer daysSinceLastCommit, boolean active, String lastCommitDate) {}
   ```
   `PortfolioScanEntry(String name, int readiness, int baseReadiness, String scannedAt, GitActivity gitActivity)`
   where `gitActivity` may be `null`.

2. **`PortfolioScanFileReader.parse()`** — read `project.path("activity")`. If the
   node is missing/null, `gitActivity = null`. Otherwise extract the three fields
   (`daysSinceLastCommit`, `isActive`, `lastCommitDate`), tolerating missing
   sub-fields (null `daysSinceLastCommit`, `active` defaults false, null date).

3. **`PortfolioReadinessResponse`** — add `Integer daysSinceLastCommit`,
   `Boolean active`, `Instant lastCommitDate`. **`readiness`/`baseReadiness`
   computation is untouched** — these fields are carried straight through.

4. **`PortfolioReadinessService.listReadiness()`** — map `entry.gitActivity()` into
   the response (null entry → null fields). Reuse existing `parseInstant` for
   `lastCommitDate`.

## Web changes

1. **`types/portfolio.ts`** — add `daysSinceLastCommit: number | null`,
   `active: boolean | null`, `lastCommitDate: string | null` to `PortfolioReadiness`.

2. **`PortfolioReadinessBadge`** — append git activity after the existing label.
   Example: `포트폴리오 80% · 커밋 3일 전 🟢`
   - **Disambiguation (important):** the existing badge's "3일 전" is `ageDays`
     (how long since the *scan*). The new value is *days since last commit* — a
     different meaning. The new value MUST carry the **"커밋"** label so the two
     are never confused.
   - Active dot: 🟢 when `active === true`, ⚪ when `active === false`, omitted when null.
   - `lastCommitDate` (if present) goes into the badge `title` for an exact-date tooltip.
   - When all git fields are null, render exactly today's badge (no regression).

## Edge cases & errors

- `activity` absent (no-git project) → `gitActivity` null → web omits git part;
  readiness/badge unchanged.
- `daysSinceLastCommit` missing/negative → omit the "커밋 N일 전" text.
- Whole `/portfolio-readiness` failure → existing graceful degradation (empty Map);
  no behavior change.

## Testing

- **Backend (pure logic):**
  - `PortfolioScanFileReader` parse test: JSON *with* `activity`, *without* `activity`,
    and with partial `activity` (missing sub-fields).
  - `PortfolioReadinessService` mapping test: entry with/without `gitActivity` →
    correct response fields; assert `readiness` unaffected.
- **Web:** `PortfolioReadinessBadge` render test (follow existing test pattern):
  with git fields, with nulls (parity with current output), active vs inactive dot.

## Out of scope (YAGNI)

- Commit message display, weekly commit count, per-thread detail view.
- Any influence of git activity on `readiness` or `threadAdjustment`.
- Separate `/portfolio-activity` endpoint.
