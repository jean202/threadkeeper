#!/usr/bin/env node

import { importSourceSessions } from "./index.js";

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
  const needsMigrator = targets.some((t) => t !== "codex");
  if (needsMigrator && !options.cliPath) {
    throw new Error("--migrator-path is required");
  }

  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const payload = await importSourceSessions(options);
  console.log(JSON.stringify(payload, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
