import { readFileSync } from "node:fs";
import path from "node:path";
import { sanitizeString } from "./sanitize.js";

const TITLE_MAX = 200;
const PROJECT_KEY_MAX = 100;

function deriveProjectKey(cwd) {
  if (typeof cwd !== "string" || cwd.trim() === "") return "unknown";
  const base = path.basename(cwd).toLowerCase().replace(/[^a-z0-9._-]/g, "-");
  if (!base) return "unknown";
  return sanitizeString(base, PROJECT_KEY_MAX);
}

export function extractSessionFromFile(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return null;

  let meta;
  try {
    meta = JSON.parse(lines[0]);
  } catch {
    return null;
  }
  if (meta?.type !== "session_meta" || !meta.payload?.id) return null;

  const payload = meta.payload;
  return {
    provider: "CODEX",
    providerSessionKey: payload.id,
    sourceType: "session",
    sourcePath: filePath,
    startedAt: payload.timestamp ?? null,
    projectKey: deriveProjectKey(payload.cwd),
  };
}
