# ThreadKeeper Integration Architecture

## 1. Positioning

ThreadKeeper should not replace `agent-state-migrator`.

Instead:

- `agent-state-migrator` remains the local state discovery and migration engine
- `ThreadKeeper` becomes the orchestration and memory product layer

## 2. Layered Architecture

### Layer A: Provider State Collection

Responsibility:

- discover provider-specific files and folders
- inspect session, plan, todo, and history artifacts
- back up or diff provider state

Existing fit:

- `agent-state-migrator`

### Layer B: Canonical Session Extraction

Responsibility:

- normalize provider-specific data into a shared event model
- extract session identifiers, titles, timestamps, plan artifacts, and project links
- attach provider metadata and source references

Owned by:

- ThreadKeeper ingestion workers

### Layer C: Session Intelligence

Responsibility:

- detect first intent
- generate current summaries
- compute drift
- propose next actions
- produce handoff cards

Owned by:

- ThreadKeeper summarization pipeline

### Layer D: User Experience

Responsibility:

- dashboard
- session detail view
- daily briefing
- notifications

Owned by:

- ThreadKeeper app

## 3. Integration Strategy With `agent-state-migrator`

### Recommended integration path

ThreadKeeper calls `agent-state-migrator` in one of two ways:

- CLI mode
- embedded library mode later if extraction logic stabilizes

### Phase 1: CLI integration

ThreadKeeper runs commands such as:

```bash
node src/cli.js inspect --profile full --target codex,claude --with-metadata
```

ThreadKeeper then parses the output and imports:

- sessions
- plans
- todos
- history
- project metadata

This is the fastest way to ship because it reuses proven path definitions.

### Phase 2: shared package extraction

If the integration becomes central, move provider definitions and inspect logic into a reusable package such as:

- `@jean202/agent-state-core`

Then:

- `agent-state-migrator` uses that package for backup and restore
- `ThreadKeeper` uses that package for ingestion

## 4. Canonical Data Flow

```text
Provider local state
  -> agent-state-migrator inspect
  -> ThreadKeeper ingestion adapter
  -> canonical session events
  -> summary and drift pipeline
  -> session registry database
  -> dashboard and notifications
```

## 5. Canonical Domain Model

### `provider_accounts`

- which provider is configured
- local user identity or installation metadata

### `source_sessions`

- provider-native session records
- path references
- raw metadata

### `threads`

- logical work unit across one or more source sessions
- original intent anchor

### `thread_snapshots`

- periodic summaries
- drift assessment
- next action

### `handoffs`

- transitions between sessions or providers
- structured transfer notes

### `notification_rules`

- rule definitions
- thresholds

### `notification_events`

- sent notifications
- reason and delivery channel

## 6. Summarization Pipeline

### Inputs

- provider session artifacts
- plan files
- todo files
- recent transcript excerpts when available
- user-entered intent note

### Outputs

- initial intent summary
- latest progress summary
- detected blockers
- next action
- drift score

## 7. Drift Detection Model

Drift does not need full agent autonomy. Start with a simple scoring model:

- compare initial intent against latest task summary
- compare referenced files with intended scope
- compare unfinished todos with current active artifacts

Statuses:

- `ON_TRACK`
- `DRIFTING`
- `BLOCKED`
- `COMPLETED`

## 8. Notification Architecture

### Sources

- inactivity timer
- status transition
- daily briefing scheduler
- drift threshold event

### Channels for MVP

- desktop notification
- Discord webhook
- email later

## 9. Recommended Tech Stack

### Backend

- Spring Boot or Node.js backend
- PostgreSQL
- scheduled jobs

### Frontend

- Next.js dashboard

### Integrations

- CLI bridge to `agent-state-migrator`
- local filesystem ingestion
- Discord webhook notifier

## 10. Why This Split Is Better

- keeps migration and product concerns separate
- reduces risk when provider paths change
- lets ThreadKeeper focus on continuity and actionability
- makes Gemini and ChatGPT support easier later
