# ThreadKeeper Repo And Build Structure

## 1. Recommended Repository Name

- GitHub repository: `threadkeeper`

Why this name:

- clear relationship to conversation threads and work threads
- broad enough for Claude, Gemini, GPT, and Codex
- product-oriented rather than implementation-oriented

## 2. Product Naming

- Product name: `ThreadKeeper`
- Internal short name: `tk`

## 3. Recommended Monorepo Shape

```text
threadkeeper/
  README.md
  docs/
  apps/
    tk-api/
    tk-web/
    tk-worker/
  packages/
    provider-sdk/
    canonical-model/
    notifier-core/
    prompt-templates/
  integrations/
    agent-state-migrator-bridge/
  infra/
    docker/
    sql/
```

## 4. Module Responsibilities

### `apps/tk-api`

- REST API
- thread CRUD
- handoff CRUD
- dashboard queries
- provider import endpoints

### `apps/tk-web`

- dashboard UI
- thread detail UI
- rules and settings UI

### `apps/tk-worker`

- scheduled imports
- summarization jobs
- drift detection jobs
- notification dispatch

### `packages/provider-sdk`

- provider interfaces
- import contracts
- artifact mapping helpers

### `packages/canonical-model`

- shared DTOs
- enums
- status models

### `packages/notifier-core`

- desktop notification adapters
- Discord webhook adapter

### `packages/prompt-templates`

- summarization prompts
- drift prompts
- daily briefing prompts

### `integrations/agent-state-migrator-bridge`

- CLI invocation
- output parsing
- import adapter

## 5. Initial Build Choice

For your stack, the most pragmatic first cut is:

- backend: Spring Boot
- frontend: Next.js
- worker: Spring scheduled jobs or lightweight Node worker

### Recommended first implementation

```text
threadkeeper/
  docs/
  threadkeeper-api/
  threadkeeper-web/
  agent-state-migrator-bridge/
```

This keeps the first version simple before extracting shared packages.

## 6. Suggested MVP Database Tables

- `threads`
- `source_sessions`
- `thread_snapshots`
- `handoffs`
- `notification_rules`
- `notification_events`
- `provider_connections`

## 7. Suggested First Milestones

### Milestone 1

- create thread manually
- save first intent
- save next action
- dashboard list

### Milestone 2

- import Claude and Codex artifacts from bridge
- attach source sessions to threads

### Milestone 3

- summarize latest state
- detect drift
- send inactivity and completion notifications

### Milestone 4

- daily briefing
- handoff composer

## 8. Portfolio Positioning

ThreadKeeper should be presented as:

- an AI workflow continuity tool
- a local-first session memory system
- a cross-provider handoff and planning assistant

This makes it distinct from `agent-state-migrator`, which is better framed as:

- a state backup and migration engine for AI coding tools
