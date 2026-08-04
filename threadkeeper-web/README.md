# ThreadKeeper Web

Next.js dashboard for ThreadKeeper.

## Screens

- `/` — thread list
- `/today` — Today dashboard (Continue Now, active, stale, blocked, completed today)
- `/threads/new` — create a thread
- `/threads/[threadId]` — thread detail and actions
- `/threads/[threadId]/handoff` — handoff composer
- `/settings/notifications` — notification rules and recent events
- `/settings/providers` — provider connections and imports

## Development

```bash
npm install
npm run dev          # expects the API on http://localhost:8080
```

`NEXT_PUBLIC_API_URL` overrides the API base URL.

## Checks

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest
```

The types in `src/types` are written by hand to mirror the API's DTOs, and
nothing validates that automatically — when a DTO changes, change the interface
in the same commit. `src/test/fixtures.ts` holds payloads captured from a
running instance, typed as those interfaces, so a mismatch between an interface
and its fixture is a compile error.

## End-to-end smoke test

The vitest suite mocks the API client, so it cannot catch the API sending a
shape the pages do not expect. `e2e/smoke.mjs` covers that by driving the real
UI against a running stack and asserting the resulting server state.

It needs postgres, the API, and the web app running, plus Chromium:

```bash
npm install --no-save playwright-core
PLAYWRIGHT_CHROMIUM=/path/to/chrome node e2e/smoke.mjs
```

It creates a thread, pins a next action, records progress, generates a handoff,
drives it into drift and back, and completes it — checking each step against the
API rather than the DOM alone.
