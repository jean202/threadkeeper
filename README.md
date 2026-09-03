# ThreadKeeper

[![CI](https://github.com/jean202/threadkeeper/actions/workflows/ci.yml/badge.svg)](https://github.com/jean202/threadkeeper/actions/workflows/ci.yml)

ThreadKeeper is a multi-agent session memory and handoff manager for AI-assisted work.

It helps users keep track of:

- what the original intent of a session was
- what was completed
- what should happen next
- when a session has drifted away from the original plan
- when to send reminders, completion notices, and daily briefings

ThreadKeeper is designed as a product layer above local state collectors such as `agent-state-migrator`.

## Documents

- [01 PRD](docs/01-prd.md)
- [02 Integration Architecture](docs/02-integration-architecture.md)
- [03 MVP Screens And Features](docs/03-mvp-screens-and-features.md)
- [04 Repo And Build Structure](docs/04-repo-and-build-structure.md)
- [05 MVP ERD](docs/05-mvp-erd.md)
- [06 REST API Draft](docs/06-rest-api-draft.md)
- [07 Local Runbook](docs/07-local-runbook.md)

## Initial Repo Layout

- [threadkeeper-api](threadkeeper-api)
- [threadkeeper-web](threadkeeper-web)
- [agent-state-migrator-bridge](agent-state-migrator-bridge)

## Checks

CI runs on every push to `main` and every pull request:

| Job | Runs |
| --- | --- |
| API | `./gradlew test` on JDK 17 (the version pinned in `build.gradle.kts`) |
| Web | `npm ci`, typecheck, lint, test, build |
| Bridge | `npm test` (`node --test`) |

`e2e/smoke.mjs` is not part of CI: it needs postgres, the API and the web app
running at once. Run it by hand as described in
[threadkeeper-web/README.md](threadkeeper-web/README.md).
