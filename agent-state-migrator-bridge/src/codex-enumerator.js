import { readFileSync } from "node:fs";
import path from "node:path";
import { sanitizeString } from "./sanitize.js";

const TITLE_MAX = 200;
const PROJECT_KEY_MAX = 100;
const INTENT_MAX = 4000;

function safeParseLine(line) {
  try { return JSON.parse(line); } catch { return null; }
}

function deriveProjectKey(cwd) {
  if (typeof cwd !== "string" || cwd.trim() === "") return "unknown";
  const base = path.basename(cwd).toLowerCase().replace(/[^a-z0-9._-]/g, "-");
  if (!base) return "unknown";
  return sanitizeString(base, PROJECT_KEY_MAX);
}

function findFirstUserMessage(lines) {
  for (let i = 1; i < lines.length; i += 1) {
    const obj = safeParseLine(lines[i]);
    if (!obj) continue;
    if (obj.type === "event_msg" && obj.payload?.type === "user_message") {
      const msg = obj.payload.message;
      if (typeof msg === "string" && msg.length > 0) {
        return sanitizeString(msg, INTENT_MAX);
      }
    }
  }
  return null;
}

export function extractSessionFromFile(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return null;

  const meta = safeParseLine(lines[0]);
  if (!meta || meta.type !== "session_meta" || !meta.payload?.id) return null;

  const payload = meta.payload;
  return {
    provider: "CODEX",
    providerSessionKey: payload.id,
    sourceType: "session",
    sourcePath: filePath,
    startedAt: payload.timestamp ?? null,
    projectKey: deriveProjectKey(payload.cwd),
    originalIntent: findFirstUserMessage(lines),
  };
}
