import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { enumerateCodexSessions } from "./codex-enumerator.js";
import { enumerateClaudeSessions } from "./claude-enumerator.js";
import { collapseRepeatedPrompts } from "./repeat-collapser.js";

const execFileAsync = promisify(execFile);

const SESSION_KEY_PATTERNS = [
  /\/sessions\/([^/]+)\.json$/i,
  /\/plans\/([^/]+)\.md$/i,
  /\/todos\/([^/]+)\.md$/i,
  /\/projects\/([^/]+)\//i,
];

function toProviderEnum(provider) {
  return provider.toUpperCase();
}

/** Targets whose sessions are read straight from disk, without the migrator. */
export const DIRECT_TARGETS = ["codex", "claude"];

function targetsList(target) {
  return String(target ?? "").split(",").map((t) => t.trim()).filter(Boolean);
}

function defaultCodexSessionsRoot() {
  return path.join(os.homedir(), ".codex", "sessions");
}

function defaultClaudeProjectsRoot() {
  return path.join(os.homedir(), ".claude", "projects");
}

/** Both enumerators emit the same session shape; only the provider differs. */
function buildSourceSessionsFromEnumeration(enumeration) {
  return enumeration.sessions.map((s) => ({
    provider: s.provider,
    providerSessionKey: s.providerSessionKey,
    sourceType: s.sourceType,
    sourcePath: s.sourcePath,
    title: s.title,
    importedAt: new Date().toISOString(),
    startedAt: s.startedAt,
    lastActivityAt: s.lastActivityAt,
    projectKey: s.projectKey,
    originalIntent: s.originalIntent,
    nextAction: s.nextAction,
    metadata: {
      sourceType: s.sourceType,
      cwd: s.cwd ?? null,
    },
  }));
}

function detectProviderSessionKey(relativePath, sourcePath, fallbackId) {
  for (const pattern of SESSION_KEY_PATTERNS) {
    const match = pattern.exec(relativePath) || pattern.exec(sourcePath);
    if (match) {
      return match[1];
    }
  }
  return fallbackId;
}

function normalizeItem(item) {
  const primaryArtifact = item.artifacts?.[0];
  const sourcePath = item.sourcePath ?? "";
  const relativePath = primaryArtifact?.relativePath ?? "";
  const providerSessionKey = detectProviderSessionKey(relativePath, sourcePath, item.id);

  return {
    provider: toProviderEnum(item.provider),
    providerSessionKey,
    sourceType: item.key,
    sourcePath,
    title: item.description,
    importedAt: new Date().toISOString(),
    metadata: {
      itemId: item.id,
      profile: item.profile,
      sensitivity: item.sensitivity,
      sourceType: item.sourceType,
      artifactCount: item.artifactCount,
      relativePath,
    },
  };
}

export function mapInspectResultsToCanonicalImportPayload(inspectResults) {
  const sourceSessions = inspectResults
    .filter((item) => item.exists)
    .map(normalizeItem);

  const providers = [...new Set(sourceSessions.map((session) => session.provider))];

  return {
    importedAt: new Date().toISOString(),
    providers,
    sourceSessions,
  };
}

export async function inspectProviders({
  cliPath,
  profile = "full",
  target = "codex,claude",
  includeSensitive = false,
  cwd,
}) {
  const args = ["src/cli.js", "inspect", "--profile", profile, "--target", target, "--json"];
  if (includeSensitive) {
    args.push("--include-sensitive");
  }

  const { stdout } = await execFileAsync("node", args, {
    cwd: cwd ?? cliPath,
  });

  return JSON.parse(stdout);
}

export async function importSourceSessions(options) {
  const targets = targetsList(options.target ?? "codex,claude");
  const sourceSessions = [];
  const summary = {};

  if (targets.includes("codex")) {
    const root = options.codexHome ?? defaultCodexSessionsRoot();
    const enumeration = enumerateCodexSessions(root);
    sourceSessions.push(...buildSourceSessionsFromEnumeration(enumeration));
    summary.codex = enumeration.summary;
  }

  // Claude Code keeps one transcript per session, so read them directly like
  // Codex rollouts. The migrator's inspect output is per artifact group, which
  // collapsed every session of a project into a single untitled thread.
  if (targets.includes("claude")) {
    const root = options.claudeHome ?? defaultClaudeProjectsRoot();
    const enumeration = enumerateClaudeSessions(root);
    sourceSessions.push(...buildSourceSessionsFromEnumeration(enumeration));
    summary.claude = enumeration.summary;
  }

  // Automated runs (a review hook firing `codex exec` on every change) would
  // otherwise land as a wall of identical threads, one per run.
  const directSessions = collapseRepeatedPrompts(sourceSessions, { minRepeats: options.minRepeats });
  sourceSessions.length = 0;
  sourceSessions.push(...directSessions.sessions);
  summary.repeatedPrompts = directSessions.collapsed;

  const viaMigrator = targets.filter((t) => !DIRECT_TARGETS.includes(t));
  if (viaMigrator.length > 0 && options.cliPath) {
    const inspectResults = await inspectProviders({ ...options, target: viaMigrator.join(",") });
    const mapped = mapInspectResultsToCanonicalImportPayload(inspectResults);
    sourceSessions.push(...mapped.sourceSessions);
  }

  const providers = [...new Set(sourceSessions.map((s) => s.provider))];
  return {
    importedAt: new Date().toISOString(),
    providers,
    sourceSessions,
    summary,
  };
}
