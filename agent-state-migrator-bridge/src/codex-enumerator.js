import { readFileSync, readdirSync, existsSync } from "node:fs";
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

/**
 * Claude Code runs worktree sessions in `<repo>/.claude/worktrees/<name>`, so
 * the basename would name the worktree, not the project. Strip that suffix so
 * a worktree session lands in the same project as the main checkout.
 */
const WORKTREE_SUFFIX_RE = /\/\.claude\/worktrees\/[^/]+\/?$/;

/** The project folder a session ran in, with a worktree suffix stripped. */
export function projectDir(cwd) {
  return cwd.replace(WORKTREE_SUFFIX_RE, "");
}

export function deriveProjectKey(cwd) {
  if (typeof cwd !== "string" || cwd.trim() === "") return "unknown";
  const base = path.basename(projectDir(cwd)).toLowerCase().replace(/[^a-z0-9._-]/g, "-");
  if (!base) return "unknown";
  return sanitizeString(base, PROJECT_KEY_MAX);
}

/**
 * Sections Codex puts in a user turn on the user's behalf: the environment
 * block, AGENTS.md and other instructions. They come before the typed prompt,
 * sometimes as their own content block and sometimes at the head of the same
 * block, so they are stripped from the front rather than the whole text being
 * judged by how it starts.
 */
/**
 * Only the tags Codex itself writes. A user can wrap their own prompt in a
 * tag (a templated "<task>...</task>"), and stripping any tag at all threw
 * those prompts away.
 */
const CODEX_WRAPPER_TAGS = [
  "environment_context",
  "user_instructions",
  "permissions instructions",
  "INSTRUCTIONS",
  "turn_aborted",
  "user_shell_command",
];

const LEADING_WRAPPER_RES = [
  /^\s*# AGENTS\.md instructions[^\n]*\n+\s*<INSTRUCTIONS>[\s\S]*?<\/INSTRUCTIONS>/,
  ...CODEX_WRAPPER_TAGS.map((tag) => new RegExp(`^\\s*<${tag}>[\\s\\S]*?</${tag}>`)),
];

function stripLeadingWrappers(text) {
  let rest = text;
  for (let changed = true; changed; ) {
    changed = false;
    for (const re of LEADING_WRAPPER_RES) {
      const next = rest.replace(re, "");
      if (next !== rest) {
        rest = next;
        changed = true;
      }
    }
  }
  return rest.trim();
}

/**
 * With the in-app browser or a file attached, Codex puts that context first
 * and heads what the user typed with "## My request:".
 */
const MY_REQUEST_HEADING_RE = /^## My request:[ \t]*$/m;

/** What the user typed in one block of a user turn, without Codex's additions. */
export function typedPromptText(text) {
  const rest = stripLeadingWrappers(text);
  const parts = rest.split(MY_REQUEST_HEADING_RE);
  return parts[parts.length - 1].trim();
}

/** The text blocks of a response_item message from `role`, in order. */
function responseItemBlocks(payload, role) {
  if (payload?.type !== "message" || payload.role !== role || !Array.isArray(payload.content)) return [];
  return payload.content
    .filter((block) => typeof block?.text === "string" && /^(input|output)_text$/.test(block.type))
    .map((block) => block.text);
}

/** The first thing in a user message the user actually typed, if any. */
export function typedUserText(payload) {
  for (const block of responseItemBlocks(payload, "user")) {
    const text = typedPromptText(block);
    if (text) return text;
  }
  return "";
}

export function responseItemText(payload, role) {
  return responseItemBlocks(payload, role).join("\n").trim();
}

function findFirstUserMessage(lines) {
  // The event_msg is exactly what the user typed, so prefer it when present.
  for (let i = 1; i < lines.length; i += 1) {
    const obj = safeParseLine(lines[i]);
    if (!obj) continue;
    if (obj.type === "event_msg" && obj.payload?.type === "user_message") {
      const msg = obj.payload.message;
      if (typeof msg === "string" && msg.trim().length > 0) {
        return sanitizeString(msg, INTENT_MAX);
      }
    }
  }
  for (let i = 1; i < lines.length; i += 1) {
    const obj = safeParseLine(lines[i]);
    if (!obj || obj.type !== "response_item") continue;
    const text = typedUserText(obj.payload);
    if (text) return sanitizeString(text, INTENT_MAX);
  }
  return null;
}

function findNextAction(lines) {
  let lastAgent = null;
  let lastUser = null;
  let lastAssistantItem = null;
  for (let i = 1; i < lines.length; i += 1) {
    const obj = safeParseLine(lines[i]);
    if (!obj) continue;
    if (obj.type === "response_item") {
      const text = responseItemText(obj.payload, "assistant");
      if (text) lastAssistantItem = text;
      continue;
    }
    if (obj.type !== "event_msg") continue;
    const pt = obj.payload?.type;
    const msg = obj.payload?.message;
    if (typeof msg !== "string" || msg.length === 0) continue;
    if (pt === "agent_message") lastAgent = msg;
    else if (pt === "user_message") lastUser = msg;
  }
  const chosen = lastAgent ?? lastAssistantItem ?? lastUser;
  return chosen == null ? null : sanitizeString(chosen, NEXT_ACTION_MAX);
}

function deriveTitle(originalIntent, projectKey, startedAt) {
  const singleLine = typeof originalIntent === "string"
    ? originalIntent.replace(/\s+/g, " ").trim()
    : "";
  if (singleLine.length > 0) {
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

export function findRolloutFiles(rootDir) {
  if (!existsSync(rootDir)) return [];
  const out = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && /^rollout-.+\.jsonl$/.test(entry.name)) {
        out.push(full);
      }
    }
  }
  walk(rootDir);
  return out;
}

/**
 * A session another Codex agent started to hand off part of its work. Its
 * instructions arrive as agent_message items ("Message Type: NEW_TASK"), and
 * no person typed anything into it -- the user turns are only Codex's own
 * AGENTS.md and environment blocks. The work already belongs to the session
 * that delegated it, so like Claude's subagent transcripts it is not a thread.
 */
function isDelegatedSubSession(lines) {
  return lines.some((line) => {
    const obj = safeParseLine(line);
    return obj?.type === "response_item" && obj.payload?.type === "agent_message";
  });
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
  // Only when nobody typed into it: a session the user drives can still
  // exchange messages with agents it spawned.
  if (originalIntent === null && isDelegatedSubSession(lines)) return null;
  return {
    provider: "CODEX",
    providerSessionKey: payload.id,
    sourceType: "session",
    sourcePath: filePath,
    startedAt,
    projectKey,
    cwd: typeof payload.cwd === "string" ? payload.cwd : null,
    originalIntent,
    nextAction: findNextAction(lines),
    lastActivityAt: findLastActivityAt(lines, startedAt),
    title: deriveTitle(originalIntent, projectKey, startedAt),
  };
}

/**
 * Session ids of the delegated sub-sessions under `rootDir` -- the ones
 * extractSessionFromFile leaves out. For cleaning up threads imported before
 * they were skipped.
 */
export function listDelegatedSubSessionIds(rootDir) {
  const ids = [];
  for (const file of findRolloutFiles(rootDir)) {
    try {
      const lines = readFileSync(file, "utf8").split(/\r?\n/).filter((line) => line.length > 0);
      const meta = safeParseLine(lines[0] ?? "");
      if (meta?.type !== "session_meta" || !meta.payload?.id) continue;
      if (findFirstUserMessage(lines) === null && isDelegatedSubSession(lines)) {
        ids.push(meta.payload.id);
      }
    } catch {
      // An unreadable file is not evidence of anything; leave it out.
    }
  }
  return ids;
}

export function enumerateCodexSessions(rootDir) {
  const files = findRolloutFiles(rootDir);
  const sessions = [];
  let skippedFiles = 0;
  const warnings = [];
  for (const file of files) {
    try {
      const session = extractSessionFromFile(file);
      if (session) {
        sessions.push(session);
      } else {
        skippedFiles += 1;
        warnings.push({ file, reason: "no session_meta, or a session another agent delegated" });
      }
    } catch (err) {
      skippedFiles += 1;
      warnings.push({ file, reason: `extract failed: ${err.message}` });
    }
  }
  return {
    sessions,
    summary: {
      scanned: files.length,
      emitted: sessions.length,
      skippedFiles,
      warnings,
    },
  };
}
