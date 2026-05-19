# Agent State Migrator Bridge

This module bridges `agent-state-migrator` and ThreadKeeper.

Its responsibilities are:

- invoke `agent-state-migrator inspect`
- parse provider artifacts
- normalize results into ThreadKeeper import payloads

Planned entry points:

- `inspectProviders()`
- `importSourceSessions()`
- `mapArtifactsToCanonicalEvents()`
