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

Return the latest import summary.

## 7. Dashboard

### `GET /api/v1/dashboard/today`

Return dashboard data.

Response sections:

- active threads
- stale threads
- blocked threads
- completed today
- recommended order

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

Update a rule.

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
