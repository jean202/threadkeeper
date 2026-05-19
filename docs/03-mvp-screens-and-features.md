# ThreadKeeper MVP Screens And Features

## 1. MVP Product Slice

The MVP should solve one concrete user promise:

`At any moment, I can recover the original purpose and next action of my AI work without digging through transcripts.`

## 2. Screen List

### Screen A: Today Dashboard

Purpose:

- show what deserves attention right now

Sections:

- active threads
- stale threads
- blocked threads
- completed today
- recommended next session order

Key widgets:

- `Continue Now`
- `Drift Warning`
- `Needs Handoff`
- `Completed Recently`

### Screen B: Thread Detail

Purpose:

- show one thread's continuity record

Sections:

- original intent
- today's goal
- latest summary
- next action
- linked source sessions
- handoff history
- related files or notes

Key actions:

- `Mark Completed`
- `Create Handoff`
- `Refresh Summary`
- `Pin Next Action`

### Screen C: Handoff Composer

Purpose:

- create a clean transfer from one session or provider to another

Fields:

- source provider and session
- target provider
- what was done
- what is blocked
- next action
- files to look at

### Screen D: Notifications And Rules

Purpose:

- control reminder noise

Settings:

- inactive after N minutes
- morning briefing time
- send completion notice
- send drift alerts
- notification channels

### Screen E: Provider Connections

Purpose:

- inspect ingestion status

Sections:

- configured providers
- last import time
- imported artifacts count
- ingestion errors

## 3. MVP Features

### Must-have

- import Claude and Codex session artifacts
- create canonical threads
- preserve first intent note
- generate latest summary
- store one next action per thread
- mark thread status
- create handoff card
- daily dashboard
- inactivity notification
- completion notification

### Should-have

- drift score and warning badge
- manual merge of related sessions into one thread
- morning briefing notification

### Not now

- Gemini integration
- ChatGPT browser plugin
- shared team workspaces
- mobile app
- transcript semantic search

## 4. Example User Flow

### Start a thread

1. User opens ThreadKeeper
2. User creates or imports a thread
3. User writes:
   - original intent
   - done condition
   - today's goal

### Work in an AI tool

1. User works in Claude or Codex
2. ThreadKeeper imports new artifacts
3. ThreadKeeper refreshes latest summary

### Switch tools

1. User clicks `Create Handoff`
2. ThreadKeeper drafts:
   - what changed
   - next action
   - risks
3. User opens target tool with the handoff note

### Return next day

1. User receives daily briefing
2. Dashboard shows active threads
3. User picks `Continue Now`

## 5. Notification Events

### Completion notice

- trigger: status changes to `COMPLETED`
- message: summary + completion timestamp + follow-up recommendation

### Inactivity reminder

- trigger: no thread activity for X minutes or hours
- message: original intent + last next action

### Morning briefing

- trigger: scheduled daily time
- message: top three threads to resume

### Drift warning

- trigger: drift score crosses threshold
- message: current focus differs from original goal

## 6. MVP UX Principles

- one-screen recovery for interrupted work
- emphasize next action over transcript depth
- show original intent prominently
- minimize settings before first value
