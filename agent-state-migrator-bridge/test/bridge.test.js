import test from "node:test";
import assert from "node:assert/strict";

import { mapInspectResultsToCanonicalImportPayload } from "../src/index.js";

test("maps inspect results into canonical source sessions", () => {
  const inspectResults = [
    {
      id: "codex:sessions",
      key: "sessions",
      provider: "codex",
      profile: "full",
      sensitivity: "standard",
      sourceType: "dir",
      sourcePath: "/Users/test/.codex/sessions",
      exists: true,
      artifactCount: 1,
      description: "Codex sessions",
      artifacts: [
        {
          relativePath: "HOME/.codex/sessions/session-1.json",
        },
      ],
    },
    {
      id: "claude:plans",
      key: "plans",
      provider: "claude",
      profile: "full",
      sensitivity: "standard",
      sourceType: "dir",
      sourcePath: "/Users/test/.claude/plans",
      exists: true,
      artifactCount: 1,
      description: "Claude plans",
      artifacts: [
        {
          relativePath: "HOME/.claude/plans/plan-1.md",
        },
      ],
    },
    {
      id: "claude:missing",
      key: "history",
      provider: "claude",
      profile: "full",
      sensitivity: "standard",
      sourceType: "missing",
      sourcePath: "/Users/test/.claude/history.jsonl",
      exists: false,
      artifactCount: 0,
      description: "Claude history",
      artifacts: [],
    },
  ];

  const payload = mapInspectResultsToCanonicalImportPayload(inspectResults);

  assert.deepEqual(payload.providers, ["CODEX", "CLAUDE"]);
  assert.equal(payload.sourceSessions.length, 2);
  assert.equal(payload.sourceSessions[0].providerSessionKey, "session-1");
  assert.equal(payload.sourceSessions[0].sourceType, "sessions");
  assert.equal(payload.sourceSessions[1].providerSessionKey, "plan-1");
});
