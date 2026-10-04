#!/usr/bin/env node

import path from "node:path";
import { DIRECT_TARGETS, defaultCodexSessionsRoot, importSourceSessions } from "./index.js";
import {
  ResumeLookupError,
  buildResumePacket,
  findResumeSession,
  readThreadNames,
  renderResumePacket,
} from "./codex-resume.js";

export function parseArguments(argv) {
  const options = {
    profile: "full",
    target: "codex,claude",
    includeSensitive: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value =
      argv[index + 1] && !argv[index + 1].startsWith("--")
        ? argv[index + 1]
        : undefined;

    switch (token) {
      case "--migrator-path":
        options.cliPath = value;
        index += 1;
        break;
      case "--profile":
        options.profile = value;
        index += 1;
        break;
      case "--target":
        options.target = value;
        index += 1;
        break;
      case "--codex-home":
        options.codexHome = value;
        index += 1;
        break;
      case "--claude-home":
        options.claudeHome = value;
        index += 1;
        break;
      case "--min-repeats":
        options.minRepeats = Number(value);
        index += 1;
        break;
      case "--include-sensitive":
        options.includeSensitive = true;
        break;
      default:
        break;
    }
  }

  const targets = String(options.target)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const needsMigrator = targets.some((t) => !DIRECT_TARGETS.includes(t));
  if (needsMigrator && !options.cliPath) {
    throw new Error("--migrator-path is required");
  }

  return options;
}

export function parseResumeArguments(argv) {
  const options = { cwd: process.cwd(), json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    switch (token) {
      case "--cwd":
        options.cwd = value;
        index += 1;
        break;
      case "--session":
        options.session = value;
        index += 1;
        break;
      case "--codex-home":
        options.codexHome = value;
        index += 1;
        break;
      case "--json":
        options.json = true;
        break;
      default:
        break;
    }
  }
  return options;
}

/**
 * Prints the resume packet of the Codex session to pick up in Claude. Exits 2,
 * listing recent sessions, when there is none to pick.
 */
function resume(options) {
  // Same meaning as for import: the sessions root. Codex keeps its index beside it.
  const sessionsRoot = options.codexHome ?? defaultCodexSessionsRoot();
  const threadNames = readThreadNames(path.join(path.dirname(sessionsRoot), "session_index.jsonl"));
  let file;
  try {
    file = findResumeSession({ sessionsRoot, cwd: options.cwd, session: options.session });
  } catch (error) {
    if (!(error instanceof ResumeLookupError)) throw error;
    console.error(error.message);
    if (error.candidates.length > 0) {
      console.error("Recent Codex sessions (pass one with --session <id>):");
      for (const c of error.candidates) {
        console.error(`- ${c.id}  ${c.lastActivityAt}  ${c.cwd ?? "?"}  ${threadNames.get(c.id) ?? ""}`.trimEnd());
      }
    }
    return 2;
  }
  const packet = buildResumePacket(file, { threadNames });
  console.log(options.json ? JSON.stringify(packet, null, 2) : renderResumePacket(packet));
  return 0;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "resume") {
    process.exitCode = resume(parseResumeArguments(argv.slice(1)));
    return;
  }
  const options = parseArguments(argv);
  const payload = await importSourceSessions(options);
  console.log(JSON.stringify(payload, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
