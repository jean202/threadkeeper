import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { sanitizeString } from "./sanitize.js";
import { deriveProjectKey } from "./codex-enumerator.js";

const TITLE_CODE_POINTS = 80;
const INTENT_MAX = 4000;
const NEXT_ACTION_MAX = 4000;

/**
 * User turns that Claude Code writes on the user's behalf rather than the user
 * typing them: slash-command wrappers, local command output, interrupt markers.
 * None of them says what the session is about, so none can be its title.
 */
const NOT_TYPED_BY_USER_RE =
  /^\s*(<command-name>|<command-message>|<local-command-stdout>|<local-command-stderr>|<local-command-caveat>|<system-reminder>|Caveat: |\[Request interrupted)/;

function safeParseLine(line) {
  try { return JSON.parse(line); } catch { return null; }
}

/** The text a message carries, ignoring images, tool calls and tool results. */
function textOf(message) {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  if (content.some((block) => block?.type === "tool_result")) return "";
  return content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
}

function isMainChain(entry) {
  return entry.isSidechain !== true;
}

function typedUserText(entry) {
  if (entry.type !== "user" || entry.isMeta === true || !isMainChain(entry)) return "";
  const text = textOf(entry.message).trim();
  if (text === "" || NOT_TYPED_BY_USER_RE.test(text)) return "";
  return text;
}

function assistantText(entry) {
  if (entry.type !== "assistant" || !isMainChain(entry)) return "";
  return textOf(entry.message).trim();
}

/**
 * Session transcripts sit directly in each project directory as
 * `<session-id>.jsonl`. Subdirectories hold subagent transcripts and tool
 * output, and older versions wrote subagents as top-level `agent-*.jsonl`;
 * both are parts of a session, not sessions of their own.
 */
export function findClaudeSessionFiles(projectsRoot) {
  if (!existsSync(projectsRoot)) return [];
  const out = [];
  let projectDirs;
  try {
    projectDirs = readdirSync(projectsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const projectDir of projectDirs) {
    if (!projectDir.isDirectory()) continue;
    const dir = path.join(projectsRoot, projectDir.name);
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".jsonl") && !entry.name.startsWith("agent-")) {
        out.push(path.join(dir, entry.name));
      }
    }
  }
  return out;
}

export function extractClaudeSessionFromFile(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const entries = raw
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map(safeParseLine)
    .filter(Boolean);

  let sessionId = null;
  let cwd = null;
  let startedAt = null;
  let lastActivityAt = null;
  let firstUserText = null;
  let lastUserText = null;
  let lastAssistantText = null;
  let customTitle = null;

  for (const entry of entries) {
    if (!sessionId && typeof entry.sessionId === "string") sessionId = entry.sessionId;
    if (!cwd && typeof entry.cwd === "string" && entry.cwd.trim() !== "") cwd = entry.cwd;
    if (typeof entry.timestamp === "string") {
      if (!startedAt) startedAt = entry.timestamp;
      lastActivityAt = entry.timestamp;
    }
    // Set by /rename; the user's own name for the session beats any guess.
    if (entry.type === "custom-title" && typeof entry.customTitle === "string" && entry.customTitle.trim()) {
      customTitle = entry.customTitle.trim();
    }

    const userText = typedUserText(entry);
    if (userText) {
      if (!firstUserText) firstUserText = userText;
      lastUserText = userText;
    }
    const replyText = assistantText(entry);
    if (replyText) lastAssistantText = replyText;
  }

  // A file nobody typed into -- only metadata, or a session that never got a
  // prompt -- is not a thread worth surfacing.
  if (!firstUserText) return null;

  const providerSessionKey = sessionId ?? path.basename(filePath, ".jsonl");
  const projectKey = deriveProjectKey(cwd);
  const originalIntent = sanitizeString(firstUserText, INTENT_MAX);
  const nextActionSource = lastAssistantText ?? lastUserText;
  const titleSource = (customTitle ?? firstUserText).replace(/\s+/g, " ").trim();

  return {
    provider: "CLAUDE",
    providerSessionKey,
    sourceType: "session",
    sourcePath: filePath,
    startedAt,
    projectKey,
    cwd,
    originalIntent,
    nextAction: nextActionSource == null ? null : sanitizeString(nextActionSource, NEXT_ACTION_MAX),
    lastActivityAt: lastActivityAt ?? startedAt,
    title: sanitizeString(titleSource, TITLE_CODE_POINTS),
  };
}

export function enumerateClaudeSessions(projectsRoot) {
  const files = findClaudeSessionFiles(projectsRoot);
  const sessions = [];
  let skippedFiles = 0;
  const warnings = [];
  for (const file of files) {
    try {
      const session = extractClaudeSessionFromFile(file);
      if (session) {
        sessions.push(session);
      } else {
        skippedFiles += 1;
        warnings.push({ file, reason: "no typed user message" });
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
