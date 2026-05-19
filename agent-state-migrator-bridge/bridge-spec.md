# Bridge Spec

## Initial CLI Contract

ThreadKeeper should invoke `agent-state-migrator` in inspect mode first.

Example:

```bash
node src/cli.js inspect --profile full --target codex,claude --with-metadata
```

## First Import Targets

- Codex sessions
- Codex history
- Claude sessions
- Claude plans
- Claude todos
- Claude project metadata

## Canonical Mapping Goals

- one provider artifact can become one `source_session`
- one import run may update one or more `thread_snapshots`
- source metadata should retain origin paths for audit and debugging
