import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { enumerateCodexSessions } from "./codex-enumerator.js";

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

function targetsList(target) {
  return String(target ?? "").split(",").map((t) => t.trim()).filter(Boolean);
}

function defaultCodexSessionsRoot() {
  return path.join(os.homedir(), ".codex", "sessions");
}

function buildCodexSourceSessionsFromEnumeration(enumeration) {
  return enumeration.sessions.map((s) => ({
    provider: "CODEX",
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
    sourceSessions.push(...buildCodexSourceSessionsFromEnumeration(enumeration));
    summary.codex = enumeration.summary;
  }

  const nonCodex = targets.filter((t) => t !== "codex");
  if (nonCodex.length > 0 && options.cliPath) {
    const inspectResults = await inspectProviders({ ...options, target: nonCodex.join(",") });
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
