# ThreadKeeper REST API Draft

## 1. API Principles

- Base path: `/api/v1`
- JSON only
- Local-first single-user MVP
- API is centered on `threads`, not provider-native sessions

## 2. Health

### `GET /api/v1/health`

Return service health.

## 3. Threads

### `GET /api/v1/threads`

List threads, newest activity first.

All filters are optional query parameters, and omitting every one of them
returns the full list. Blank values are ignored rather than treated as a filter,
so an empty form field cannot narrow the result set.

| Parameter | Type | Matches |
| --- | --- | --- |
| `projectKey` | string | Exact project key, ignoring case |
| `provider` | `CLAUDE` \| `CODEX` \| `GEMINI` \| `GPT` | Threads with at least one imported session from that provider |
| `status` | `ACTIVE` \| `PAUSED` \| `BLOCKED` \| `COMPLETED` | Thread status |
| `priority` | `LOW` \| `MEDIUM` \| `HIGH` | Thread priority |
| `q` | string | Substring, ignoring case, of the title, original intent, next action, today's goal, or done condition |
| `activeWithinDays` | integer | Threads whose last activity falls within that many days; values of zero or less are ignored |

Filters combine with AND. An unknown enum constant is rejected with `400` and an
`INVALID_PARAMETER` body naming the accepted values.

```
GET /api/v1/threads?projectKey=threadkeeper&status=ACTIVE&q=drift
```

### `POST /api/v1/threads`

Create a thread manually.

```json
{
  "projectKey": "threadkeeper",
  "title": "Define MVP ingestion flow",
  "priority": "HIGH",
  "originalIntent": "Build a continuity layer for AI work sessions.",
  "todayGoal": "Finish the API and ERD.",
  "doneCondition": "MVP docs and starter scaffold are ready."
}
```

### `GET /api/v1/threads/{threadId}`

Get thread detail.

### `PATCH /api/v1/threads/{threadId}`

Update editable fields.

### `PATCH /api/v1/threads/{threadId}/status`

Update thread status.

```json
{
  "status": "COMPLETED"
}
```

### `PATCH /api/v1/threads/{threadId}/next-action`

Pin or replace next action.

```json
{
  "currentNextAction": "Implement source session import service."
}
```

## 4. Snapshots

### `GET /api/v1/threads/{threadId}/snapshots`

List snapshots for a thread.

### `POST /api/v1/threads/{threadId}/snapshots`

Create a snapshot manually or from summarization pipeline.

```json
{
  "snapshotType": "PROGRESS",
  "summary": "Defined canonical thread and source session model.",
  "nextAction": "Wire ingestion API to the bridge output.",
  "blockers": "Gemini provider schema not defined yet."
}
```

## 5. Handoffs

### `GET /api/v1/threads/{threadId}/handoffs`

List handoffs.

### `POST /api/v1/threads/{threadId}/handoffs`

Create a handoff card.

```json
{
  "sourceSessionId": 15,
  "targetProvider": "CLAUDE",
  "reason": "Architecture review",
  "whatChanged": "Core domain model and API draft are complete.",
  "blockers": "Need review on notification workflow.",
  "nextAction": "Refine scheduler and reminder rules.",
  "filesNote": "See docs/05-mvp-erd.md and docs/06-rest-api-draft.md"
}
```

### `PATCH /api/v1/handoffs/{handoffId}/status`

Update handoff status.

## 6. Provider Connections

### `GET /api/v1/provider-connections`

List provider connections and latest import state.

### `POST /api/v1/provider-connections`

Register a local provider connection.

```json
{
  "provider": "CODEX",
  "accountLabel": "default",
  "homePath": "/Users/jean325"
}
```

### `POST /api/v1/provider-connections/{connectionId}/imports`

Trigger import for one provider connection.

Example request:

```json
{
  "profile": "full",
  "includeSensitive": false
}
```

### `GET /api/v1/provider-connections/{connectionId}/imports/latest`

Ingestion status for one connection. `404` with `PROVIDER_CONNECTION_NOT_FOUND`
if the connection does not exist.

```json
{
  "connectionId": 1,
  "provider": "CODEX",
  "status": "ACTIVE",
  "lastImportAt": "2026-09-04T02:15:08.419Z",
  "lastErrorMessage": null,
  "importedSessionCount": 8,
  "linkedThreadCount": 7,
  "latestSessionImportedAt": "2026-09-04T02:15:08.416Z",
  "recentSessions": []
}
```

Two fields carry distinctions the session count cannot make:

- `linkedThreadCount` counts **distinct threads**, not rows. Several sessions
  can share a thread, so it is normally lower than `importedSessionCount`.
- `latestSessionImportedAt` comes from the imported rows, whereas
  `lastImportAt` is the connection's own bookkeeping. A run that finds nothing
  new moves `lastImportAt` and leaves the other alone — that gap is what
  separates "nothing to import" from "never imported". The two are stamped a
  few milliseconds apart even on a productive run, since the connection
  records its timestamp after the rows are written, so compare them with a
  tolerance rather than for equality.

`recentSessions` holds at most the five newest sessions, newest first.

## 7. Dashboard

### `GET /api/v1/dashboard/today`

Return dashboard data.

| Field | Type | Contents |
| --- | --- | --- |
| `activeThreads` | objects | Resumable threads, already ranked |
| `staleThreads` | objects | The subset of `activeThreads` untouched past the threshold |
| `blockedThreads` | objects | Blocked by status or by drift |
| `completedToday` | objects | Completed since midnight (Asia/Seoul) |
| `recommendedOrder` | **thread ids** | Resume order |

`recommendedOrder` carries ids, not objects: every id in it appears in
`activeThreads`, so repeating the objects would send each active thread twice.
Clients resolve each id against `activeThreads` — the first id is the single
thread to resume if there is only time for one.

Each thread object carries `resumeReason`, which is why the thread is being
surfaced: `COMPLETED`, `BLOCKED`, `DRIFTING`, `STALE`, `MISSING_NEXT_ACTION`,
`HIGH_PRIORITY` or `READY`.

`staleMinutes` is minutes since the last recorded activity. It is a number, not
null: a thread that has never recorded activity reports `Long.MAX_VALUE`
(`9223372036854775807`), so clients must treat an implausibly large value as
"no activity yet" rather than rendering it as a duration.

```json
{
  "activeThreads": [
    {
      "threadId": 1,
      "title": "Wire the Today dashboard",
      "priority": "HIGH",
      "status": "ACTIVE",
      "driftStatus": "ON_TRACK",
      "driftScore": null,
      "nextAction": "Implement source session import service.",
      "resumeReason": "STALE",
      "staleMinutes": 480,
      "score": 70,
      "lastActivityAt": "2026-06-25T02:00:00Z"
    }
  ],
  "staleThreads": [],
  "blockedThreads": [],
  "completedToday": [],
  "recommendedOrder": [1]
}
```

### `GET /api/v1/dashboard/briefing`

Return a daily briefing payload.

## 8. Notification Rules

### `GET /api/v1/notification-rules`

List rules.

### `POST /api/v1/notification-rules`

Create a rule.

```json
{
  "ruleType": "INACTIVITY",
  "enabled": true,
  "channel": "DISCORD",
  "thresholdMinutes": 90
}
```

### `PATCH /api/v1/notification-rules/{ruleId}`

Update a rule. This is a **partial update**: send only the fields being
changed, and every field left out keeps its stored value. `ruleType` is
immutable and is not accepted here.

```
PATCH /api/v1/notification-rules/1
{"enabled": false}
```

That request disables the rule and leaves its channel, threshold, schedule and
config exactly as they were. An empty body `{}` is valid and changes nothing.

A `configJson` that *is* sent is still validated and a bad one is rejected with
`400`; omitting it is not the same as sending an empty config.

Because "absent" and "explicitly null" arrive identically, a field cannot be
cleared back to null through this endpoint. Nothing needs to: a threshold only
applies to `INACTIVITY` rules and a schedule only to `DAILY_BRIEFING`, and the
rule type cannot change.

## 9. Notification Events

### `GET /api/v1/notification-events`

List recent delivery history.

Filters:

- `deliveryStatus`
- `eventType`

## 10. Error Model

```json
{
  "code": "THREAD_NOT_FOUND",
  "message": "The requested thread does not exist.",
  "fieldErrors": []
}
```
