# ThreadKeeper Local Runbook

## 1. What Works Now

Current local flow:

1. create provider connection
2. run bridge-backed import
3. inspect imported threads and source sessions
4. let the notification scheduler evaluate rules and dispatch queued notifications
5. manually trigger evaluation or dispatch only when needed

## 2. Start API

From `threadkeeper-api`:

```bash
./gradlew bootRun
```

Default expected database:

- database: `threadkeeper`
- username: `threadkeeper`
- password: `threadkeeper`

## 3. Configure Discord Webhook

Set:

```bash
export THREADKEEPER_DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/xxx"
export THREADKEEPER_NOTIFICATION_EVALUATION_DELAY_MS=60000
export THREADKEEPER_NOTIFICATION_DISPATCH_DELAY_MS=30000
```

Then start the API in the same shell.

Scheduler defaults:

- evaluate enabled rules every 60 seconds
- dispatch queued notifications every 30 seconds
- `INACTIVITY` alerts dedupe within the rule threshold window
- `DAILY_BRIEFING` dedupes per thread per day

## 4. Create Provider Connection

```bash
curl -sS -X POST http://localhost:8080/api/v1/provider-connections \
  -H 'Content-Type: application/json' \
  -d '{
    "provider": "CODEX",
    "accountLabel": "default",
    "homePath": "/Users/jean325"
  }'
```

## 5. Run End-To-End Import

This calls:

- `threadkeeper-api`
- `agent-state-migrator-bridge`
- `agent-state-migrator inspect --json`

```bash
curl -sS -X POST http://localhost:8080/api/v1/provider-connections/1/imports/run \
  -H 'Content-Type: application/json' \
  -d '{
    "migratorPath": "/Users/jean325/IdeaProjects/company/tixpass/agent-state-migrator",
    "bridgePath": "/Users/jean325/portfolio/projects/threadkeeper/agent-state-migrator-bridge",
    "profile": "full",
    "target": "codex,claude",
    "includeSensitive": false
  }'
```

## 6. Inspect Imported State

Threads:

```bash
curl -sS http://localhost:8080/api/v1/threads
```

Dashboard:

```bash
curl -sS http://localhost:8080/api/v1/dashboard/today
```

Briefing:

```bash
curl -sS http://localhost:8080/api/v1/dashboard/briefing
```

## 6-1. Generate Handoff Draft

This creates a persisted `DRAFT` handoff using:

- thread original intent
- latest snapshot summary, blockers, next action
- latest imported source session

```bash
curl -sS -X POST http://localhost:8080/api/v1/threads/1/handoffs/draft \
  -H 'Content-Type: application/json' \
  -d '{
    "targetProvider": "CLAUDE",
    "reasonHint": "Architecture review and next-step handoff"
  }'
```

## 7. Create Notification Rules

### Inactivity rule

```bash
curl -sS -X POST http://localhost:8080/api/v1/notification-rules \
  -H 'Content-Type: application/json' \
  -d '{
    "ruleType": "INACTIVITY",
    "enabled": true,
    "channel": "DISCORD",
    "thresholdMinutes": 60,
    "scheduledTime": null,
    "configJson": "{}"
  }'
```

### Completion rule

```bash
curl -sS -X POST http://localhost:8080/api/v1/notification-rules \
  -H 'Content-Type: application/json' \
  -d '{
    "ruleType": "COMPLETION",
    "enabled": true,
    "channel": "DISCORD",
    "thresholdMinutes": null,
    "scheduledTime": null,
    "configJson": "{}"
  }'
```

## 8. Queue Notifications

Automatic evaluation and dispatch now run in the background. These manual endpoints are still useful for testing.

Evaluate rules immediately:

```bash
curl -sS -X POST http://localhost:8080/api/v1/notification-events/evaluate
```

Mark thread complete:

```bash
curl -sS -X PATCH http://localhost:8080/api/v1/threads/1/status \
  -H 'Content-Type: application/json' \
  -d '{
    "status": "COMPLETED"
  }'
```

List queued events:

```bash
curl -sS http://localhost:8080/api/v1/notification-events
```

## 9. Dispatch Notifications

Dispatch immediately instead of waiting for the scheduler:

```bash
curl -sS -X POST http://localhost:8080/api/v1/notification-events/dispatch
```

If webhook delivery succeeds, queued events move to `SENT`.

## 10. Current Gaps

- no auth or admin guard around manual evaluation and dispatch endpoints yet
- daily briefing still uses simple `HH:mm` equality instead of a richer recurrence model
- drift alert dedupe is fixed at a 60 minute window for now
- thread merge heuristics are still basic compared with real multi-session workflows
