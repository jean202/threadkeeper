# ThreadKeeper Local Runbook

## 1. What Works Now

Current local flow:

1. create provider connection
2. run bridge-backed import
3. inspect imported threads and source sessions
4. let the notification scheduler evaluate rules and dispatch queued notifications
5. manually trigger evaluation or dispatch only when needed

## 1-1. Network Exposure

There is no authentication. ThreadKeeper is a single-user local tool, so every
component listens on loopback only and is unreachable from the network:

- API: `server.address` is `127.0.0.1` (`THREADKEEPER_BIND_ADDRESS` overrides)
- Web: `next dev` / `next start` run with `-H 127.0.0.1`
- Postgres: published as `127.0.0.1:5432:5432`, since it uses the default
  development credentials

Both `http://localhost:3000` and `http://127.0.0.1:3000` are accepted as
browser origins; `threadkeeper.web.allowed-origins` overrides that list.

Only widen `THREADKEEPER_BIND_ADDRESS` if you have put an authenticating proxy
in front — the API grants full read and write access, including the manual
evaluation and dispatch endpoints, to anyone who can reach it.

## 1-2. Log Rotation

The LaunchAgents append their stdout to `~/Library/Logs/threadkeeper`, which
grows without limit. `scripts/rotate-logs.sh` caps that, and `start.sh` and
`start-web.sh` both call it before handing stdout to the long-running process.

| Variable | Default | Meaning |
| --- | --- | --- |
| `THREADKEEPER_LOG_DIR` | `$HOME/Library/Logs/threadkeeper` | Where the `.log` files live |
| `THREADKEEPER_LOG_MAX_BYTES` | `10485760` (10 MiB) | Rotate a log once it exceeds this |
| `THREADKEEPER_LOG_KEEP` | `5` | Archives kept per log; older ones are pruned |

A rotated log is **copied to a gzip archive and then truncated in place**, not
renamed. launchd holds the file open in append mode, so renaming it would leave
launchd writing into an archive nobody reads, and deleting it would silently
discard every later line until the agent restarts. The cost is that a handful
of lines written between the copy and the truncate are lost.

Rotation only runs at boot. A machine left up for weeks keeps appending to one
file until it next restarts; run the script by hand if you need it sooner:

```bash
./scripts/rotate-logs.sh
```

A rotation failure never blocks startup — the start scripts log it and carry
on.

`scripts/rotate-logs.test.sh` covers this, and CI runs it along with
shellcheck.

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

## 9-1. Drift Detection

Drift is recomputed automatically whenever a thread's activity changes -- a new
snapshot, or an import -- and can be triggered directly:

```bash
curl -sS -X POST http://localhost:8080/api/v1/threads/1/drift-evaluation
```

The score is the share of the original intent's terms that no longer appear in
recent activity, so `100` means nothing of the original wording survives:

```json
{
  "threadId": 1,
  "conclusive": true,
  "driftScore": 100.00,
  "driftStatus": "DRIFTING",
  "explanation": "0 of 5 intent terms still present in recent activity."
}
```

`conclusive` is `false` when there is nothing to compare yet -- a thread with no
recorded activity, or an intent made only of stop words. The stored status is
left untouched in that case, so a new thread is never reported as drifting.

Tunable via environment variables:

- `THREADKEEPER_DRIFT_ENABLED` (default `true`)
- `THREADKEEPER_DRIFT_THRESHOLD` (default `60`) -- score at or above which a thread is `DRIFTING`
- `THREADKEEPER_DRIFT_RECENT_SNAPSHOTS` (default `3`)
- `THREADKEEPER_DRIFT_RECENT_SESSIONS` (default `5`)

Because only the most recent snapshots count, returning to the original topic
clears the warning on the next evaluation.

## 10. Current Gaps

- no auth or admin guard around manual evaluation and dispatch endpoints yet
- the migration test runs on H2 in PostgreSQL mode, so it catches missing or
  mistyped columns but not Postgres-specific SQL; that needs Testcontainers
- daily briefing still uses simple `HH:mm` equality instead of a richer recurrence model
- drift alert dedupe is fixed at a 60 minute window for now
- thread merge heuristics are still basic compared with real multi-session workflows
- drift scoring is lexical, so it does not recognise synonyms or verb tenses
  ("implement" and "implemented" are different terms)
- log rotation runs only at boot, so a long-running machine keeps appending to
  one file until it is restarted or the script is run by hand
