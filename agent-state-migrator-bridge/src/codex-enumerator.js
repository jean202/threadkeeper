import { readFileSync } from "node:fs";
import path from "node:path";
import { sanitizeString } from "./sanitize.js";

const TITLE_MAX = 200;
const TITLE_CODE_POINTS = 80;
const PROJECT_KEY_MAX = 100;
const INTENT_MAX = 4000;
const NEXT_ACTION_MAX = 4000;

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

function findNextAction(lines) {
  let lastAgent = null;
  let lastUser = null;
  for (let i = 1; i < lines.length; i += 1) {
    const obj = safeParseLine(lines[i]);
    if (!obj || obj.type !== "event_msg") continue;
    const pt = obj.payload?.type;
    const msg = obj.payload?.message;
    if (typeof msg !== "string" || msg.length === 0) continue;
    if (pt === "agent_message") lastAgent = msg;
    else if (pt === "user_message") lastUser = msg;
  }
  const chosen = lastAgent ?? lastUser;
  return chosen == null ? null : sanitizeString(chosen, NEXT_ACTION_MAX);
}

function deriveTitle(originalIntent, projectKey, startedAt) {
  if (typeof originalIntent === "string" && originalIntent.length > 0) {
    const singleLine = originalIntent.replace(/\s+/g, " ").trim();
    return sanitizeString(singleLine, TITLE_CODE_POINTS);
  }
  const date = typeof startedAt === "string" ? startedAt.slice(0, 10) : "unknown";
  return sanitizeString(`${projectKey} session ${date}`, TITLE_MAX);
}

function findLastActivityAt(lines, fallbackStartedAt) {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const obj = safeParseLine(lines[i]);
    if (obj && typeof obj.timestamp === "string") return obj.timestamp;
  }
  return fallbackStartedAt;
}

export function extractSessionFromFile(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return null;

  const meta = safeParseLine(lines[0]);
  if (!meta || meta.type !== "session_meta" || !meta.payload?.id) return null;

  const payload = meta.payload;
  const startedAt = payload.timestamp ?? null;
  const projectKey = deriveProjectKey(payload.cwd);
  const originalIntent = findFirstUserMessage(lines);
  return {
    provider: "CODEX",
    providerSessionKey: payload.id,
    sourceType: "session",
    sourcePath: filePath,
    startedAt,
    projectKey,
    originalIntent,
    nextAction: findNextAction(lines),
    lastActivityAt: findLastActivityAt(lines, startedAt),
    title: deriveTitle(originalIntent, projectKey, startedAt),
  };
}
