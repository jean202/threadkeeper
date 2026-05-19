# ThreadKeeper PRD

## 1. Product Summary

ThreadKeeper is a system for preserving working intent across AI coding sessions. It captures a session's first goal, tracks progress over time, summarizes drift, generates handoffs between tools, and sends reminders or completion notifications.

It is designed for users who work across multiple AI tools such as Claude, Gemini, GPT, and Codex, or who split work into many sessions inside the same tool.

## 2. Problem Statement

AI-assisted work fragments quickly.

Users often:

- start a session with a clear goal
- branch into multiple subtasks
- move between tools or windows
- return later without remembering the original intent
- lose track of what was already finished
- forget what the next action should be today

The main pain is not just lost chat history. The main pain is loss of working continuity.

## 3. Product Goal

ThreadKeeper should make it easy to answer these questions at any time:

- What was I originally trying to do?
- What changed since then?
- Which session is still active?
- What should I do next?
- What deserves attention today?

## 4. Target Users

### Primary users

- solo developers using multiple AI tools
- indie hackers switching between coding sessions
- technical users managing parallel AI-assisted tasks

### Secondary users

- researchers juggling prompt-driven workflows
- operators managing repeated tool handoffs
- makers maintaining long-lived side projects with many paused threads

## 5. Key User Scenarios

### Scenario A: Resume after interruption

A user worked with Codex yesterday, opened Claude in the morning, and cannot remember the previous session's next step. ThreadKeeper shows:

- original intent
- latest summary
- unfinished tasks
- recommended next action

### Scenario B: Cross-tool handoff

A user starts architecture work in Claude, implementation in Codex, and analysis in Gemini. ThreadKeeper creates a normalized handoff record between sessions.

### Scenario C: Drift correction

A session started as "implement billing webhook retry logic" but drifted into unrelated refactors. ThreadKeeper detects the mismatch and highlights the original goal versus current activity.

### Scenario D: Daily planning

A user wants a morning overview of:

- active sessions
- blocked sessions
- sessions completed yesterday
- today's recommended continuation order

## 6. Product Principles

- Preserve the original intent as a first-class record
- Treat sessions from different tools as one continuous work graph
- Prefer actionable summaries over raw transcript browsing
- Make interruptions recoverable in under one minute
- Keep local-first architecture where possible

## 7. Core Capabilities

### 7.1 Session Intent Capture

- Save immutable first-intent note at session start
- Store optional metadata:
  - project
  - task type
  - priority
  - expected done condition
  - today's goal

### 7.2 Progress Timeline

- Ingest session state from tool providers
- Append summaries, checkpoints, artifacts, and status updates
- Track last meaningful action time

### 7.3 Handoff Generation

- Create handoff cards when switching from one session or tool to another
- Include:
  - original intent
  - what changed
  - blockers
  - next action
  - referenced files or artifacts

### 7.4 Drift Detection

- Compare current activity with original intent
- Mark session as:
  - `ON_TRACK`
  - `DRIFTING`
  - `BLOCKED`
  - `COMPLETED`

### 7.5 Reminder And Notification Engine

- Send notifications when:
  - a session is completed
  - a session is inactive for too long
  - today has unfinished priority work
  - a session drift exceeds threshold

### 7.6 Daily Briefing

- Generate a morning summary with:
  - open sessions
  - suggested order
  - blocked items
  - stale sessions
  - today's carry-over tasks

## 8. Non-Goals For MVP

- full transcript indexing for every provider
- real-time desktop automation
- team collaboration and shared workspaces
- advanced calendar integration
- automatic control of third-party AI tools

## 9. Functional Requirements

### Session Model

- Create a canonical session record independent of provider
- Link provider-native sessions into one ThreadKeeper session graph
- Support one parent session with multiple child handoffs

### Summary Model

- Store:
  - initial intent summary
  - latest progress summary
  - current next action
  - completion note

### Notification Model

- Allow notification rules by:
  - inactivity duration
  - completion state
  - priority
  - drift score

### Search And Recovery

- Search by:
  - project
  - provider
  - status
  - keyword
  - recency

## 10. Success Metrics

- resume time after interruption
- percentage of sessions with explicit next action
- percentage of sessions recovered without opening raw transcripts
- stale session count over time
- daily briefing open rate

## 11. Product Risks

- provider data models differ too much
- summaries can become noisy or generic
- notification fatigue if defaults are too aggressive
- local state ingestion may break as tool vendors change directories or formats

## 12. MVP Definition

The MVP should support:

- Claude and Codex ingestion
- canonical session registry
- immutable first-intent storage
- latest summary and next action storage
- manual or semi-automatic handoff creation
- inactivity and completion notifications
- daily briefing page

Gemini and ChatGPT should be planned as next providers, not required for the first release.
