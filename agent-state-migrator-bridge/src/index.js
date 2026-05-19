import { execFile } from "node:child_process";
import { promisify } from "node:util";

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
  const inspectResults = await inspectProviders(options);
  return mapInspectResultsToCanonicalImportPayload(inspectResults);
}
