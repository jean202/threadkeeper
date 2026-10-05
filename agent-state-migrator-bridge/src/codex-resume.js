import { closeSync, existsSync, openSync, readFileSync, readSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import {
  findRolloutFiles,
  projectDir,
  responseItemText,
  typedPromptText,
  typedUserText,
  withoutImportedTurns,
} from "./codex-enumerator.js";
import { sanitizeString } from "./sanitize.js";

const REQUEST_MAX = 4000;
const INTENT_MAX = 1500;
const ANSWER_MAX = 3000;
const COMMENTARY_MAX = 1500;
const COMMAND_MAX = 160;
const MAX_COMMENTARY = 8;
const MAX_COMMANDS = 8;
const MAX_FILE_CHANGES = 30;
const MAX_REASONING = 5;
const MAX_PREVIOUS_TURNS = 2;
const MAX_CANDIDATES = 5;

export class ResumeLookupError extends Error {
  constructor(message, candidates) {
    super(message);
    this.name = "ResumeLookupError";
    this.candidates = candidates;
  }
}

function rawLines(file) {
  return readFileSync(file, "utf8").split(/\r?\n/).filter((line) => line.length > 0);
}

function parseLines(lines) {
  const records = [];
  for (const line of lines) {
    try {
      records.push(JSON.parse(line));
    } catch {
      // A torn last line (Codex still writing) or a malformed one; skip it.
    }
  }
  return records;
}

/** session_meta carries the base instructions, so the first line can run to tens of KB. */
function readFirstLine(file) {
  const fd = openSync(file, "r");
  try {
    const chunk = Buffer.alloc(64 * 1024);
    const parts = [];
    for (;;) {
      const read = readSync(fd, chunk, 0, chunk.length, null);
      if (read === 0) break;
      const end = chunk.subarray(0, read).indexOf(0x0a);
      if (end !== -1) {
        parts.push(Buffer.from(chunk.subarray(0, end)));
        break;
      }
      parts.push(Buffer.from(chunk.subarray(0, read)));
    }
    return Buffer.concat(parts).toString("utf8");
  } finally {
    closeSync(fd);
  }
}

function readSessionMeta(file) {
  try {
    const first = JSON.parse(readFirstLine(file));
    return first?.type === "session_meta" && first.payload?.id ? first.payload : null;
  } catch {
    return null;
  }
}

/** A session another agent spawned; its parent is the one the user drove. */
function isSubAgentSession(meta) {
  return typeof meta.source === "object" && meta.source !== null && "subagent" in meta.source;
}

/**
 * Not a sub-agent's, and not another agent's transcript that Codex imported
 * and nobody went on with: only those hold Codex work to pick up.
 */
function isResumable(file, meta) {
  return !isSubAgentSession(meta) && withoutImportedTurns(rawLines(file)) !== null;
}

function sameProjectPath(dir) {
  const root = projectDir(path.resolve(dir));
  try {
    return realpathSync(root);
  } catch {
    return root;
  }
}

/**
 * The rollout to resume: the latest one whose name contains `session`, or else
 * the latest one the user drove in `cwd`. Rollouts are appended to as the
 * session runs, so the file's mtime is its last activity.
 */
export function findResumeSession({ sessionsRoot, cwd, session }) {
  const files = findRolloutFiles(sessionsRoot)
    .map((file) => ({ file, mtimeMs: statSync(file).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (session) {
    const hit = files.find(({ file }) => {
      if (!path.basename(file).includes(session)) return false;
      const meta = readSessionMeta(file);
      return meta !== null && isResumable(file, meta);
    });
    if (hit) return hit.file;
    throw new ResumeLookupError(`No Codex session id contains "${session}".`, recentCandidates(files));
  }

  const target = sameProjectPath(cwd);
  for (const { file } of files) {
    const meta = readSessionMeta(file);
    if (!meta || typeof meta.cwd !== "string") continue;
    if (sameProjectPath(meta.cwd) === target && isResumable(file, meta)) return file;
  }
  throw new ResumeLookupError(`No Codex session ran in ${cwd}.`, recentCandidates(files));
}

function recentCandidates(files) {
  const candidates = [];
  for (const { file, mtimeMs } of files) {
    if (candidates.length === MAX_CANDIDATES) break;
    const meta = readSessionMeta(file);
    if (!meta || !isResumable(file, meta)) continue;
    candidates.push({ id: meta.id, cwd: meta.cwd ?? null, lastActivityAt: new Date(mtimeMs).toISOString(), file });
  }
  return candidates;
}

/** Codex's sidebar names, from ~/.codex/session_index.jsonl. A rename appends a line. */
export function readThreadNames(indexPath) {
  const names = new Map();
  if (!existsSync(indexPath)) return names;
  for (const entry of parseLines(rawLines(indexPath))) {
    if (typeof entry?.id === "string" && typeof entry.thread_name === "string") {
      names.set(entry.id, entry.thread_name);
    }
  }
  return names;
}

const isEvent = (record, type) => record.type === "event_msg" && record.payload?.type === type;

function completedItems(turn, type) {
  return turn
    .filter((record) => isEvent(record, "item_completed") && record.payload.item?.type === type)
    .map((record) => record.payload.item);
}

function itemText(item) {
  if (!Array.isArray(item.content)) return "";
  return item.content
    .filter((block) => typeof block?.text === "string")
    .map((block) => block.text)
    .join("\n");
}

/**
 * Turns run from task_started to task_complete or turn_aborted. Rollouts
 * written before Codex logged turns are read as a single turn.
 */
function splitTurns(records) {
  if (!records.some((record) => isEvent(record, "task_started"))) return [records];
  const turns = [];
  for (const record of records) {
    if (isEvent(record, "task_started")) turns.push([]);
    if (turns.length > 0) turns[turns.length - 1].push(record);
  }
  return turns;
}

/**
 * What the user typed in the turn. Each source repeats the others, so the
 * first one present wins: completed items, then response_items, then the
 * event_msg of older rollouts.
 */
function typedRequests(turn) {
  const fromItems = completedItems(turn, "UserMessage").map((item) => typedPromptText(itemText(item)));
  const fromResponseItems = turn
    .filter((record) => record.type === "response_item")
    .map((record) => typedUserText(record.payload));
  const fromEvents = turn
    .filter((record) => isEvent(record, "user_message") && typeof record.payload.message === "string")
    .map((record) => record.payload.message.trim());
  const pick = [fromItems, fromResponseItems, fromEvents].map((texts) => texts.filter(Boolean)).find((texts) => texts.length > 0);
  return (pick ?? []).map((text) => sanitizeString(text, REQUEST_MAX));
}

function agentMessages(turn) {
  const fromItems = completedItems(turn, "AgentMessage").map((item) => ({ text: itemText(item).trim(), phase: item.phase ?? null }));
  const fromResponseItems = turn
    .filter((record) => record.type === "response_item")
    .map((record) => ({ text: responseItemText(record.payload, "assistant"), phase: null }));
  const fromEvents = turn
    .filter((record) => isEvent(record, "agent_message") && typeof record.payload.message === "string")
    .map((record) => ({ text: record.payload.message.trim(), phase: null }));
  const pick = [fromItems, fromResponseItems, fromEvents]
    .map((messages) => messages.filter((message) => message.text))
    .find((messages) => messages.length > 0);
  return pick ?? [];
}

function turnStatus(turn) {
  const end = turn.findLast((record) => isEvent(record, "task_complete") || isEvent(record, "turn_aborted"));
  if (!end) return { kind: "unfinished" };
  if (isEvent(end, "turn_aborted")) return { kind: "aborted", reason: end.payload.reason ?? null };
  const error = end.payload.error;
  if (!error) return { kind: "completed" };
  const code = error.codex_error_info ?? null;
  return {
    kind: code === "usage_limit_exceeded" ? "usage_limit" : "error",
    code,
    message: sanitizeString(error.message ?? "", COMMENTARY_MAX),
  };
}

function finalAnswerOf(turn, messages) {
  const complete = turn.findLast((record) => isEvent(record, "task_complete"));
  const fromComplete = complete?.payload.last_agent_message;
  if (typeof fromComplete === "string" && fromComplete.trim()) return fromComplete.trim();
  const final = messages.findLast((message) => message.phase === "final_answer") ?? messages.at(-1);
  return final?.text ?? null;
}

function relativeTo(cwd, file) {
  if (cwd && file.startsWith(`${cwd}${path.sep}`)) return path.relative(cwd, file);
  return file;
}

/** Files the turn patched, in the order first touched. A file it added stays "add". */
function fileChanges(turn, cwd) {
  const kinds = new Map();
  for (const item of completedItems(turn, "FileChange")) {
    for (const [file, change] of Object.entries(item.changes ?? {})) {
      const kind = change?.type ?? "update";
      if (kinds.get(file) === "add" && kind === "update") continue;
      kinds.set(file, kind);
    }
  }
  return [...kinds].slice(0, MAX_FILE_CHANGES).map(([file, kind]) => ({ path: relativeTo(cwd, file), kind }));
}

function commands(turn) {
  return completedItems(turn, "CommandExecution")
    .slice(-MAX_COMMANDS)
    .map((item) => {
      // ["/bin/zsh", "-lc", "<script>"]: the script is what was run.
      const argv = Array.isArray(item.command) ? item.command : [String(item.command ?? "")];
      const script = String(argv.at(-1)).replace(/\s+/g, " ").trim();
      const short = Array.from(script).length > COMMAND_MAX ? `${sanitizeString(script, COMMAND_MAX)}…` : sanitizeString(script, COMMAND_MAX);
      return { command: short, exitCode: typeof item.exit_code === "number" ? item.exit_code : null };
    });
}

/** Each Reasoning item repeats the headings before it, so keep the distinct ones. */
function reasoningHeadings(turn) {
  const headings = [];
  for (const item of completedItems(turn, "Reasoning")) {
    for (const text of item.summary_text ?? []) {
      const heading = String(text).replace(/\*\*/g, "").trim();
      if (heading && !headings.includes(heading)) headings.push(heading);
    }
  }
  return headings.slice(-MAX_REASONING);
}

/** The fuller window of the last reported rate limit is the one that ran out. */
function latestRateLimit(records) {
  for (let i = records.length - 1; i >= 0; i -= 1) {
    if (!isEvent(records[i], "token_count")) continue;
    const limits = records[i].payload.rate_limits ?? {};
    const windows = [limits.primary, limits.secondary].filter((window) => typeof window?.used_percent === "number");
    if (windows.length === 0) continue;
    const window = windows.reduce((a, b) => (b.used_percent > a.used_percent ? b : a));
    return {
      usedPercent: window.used_percent,
      windowMinutes: window.window_minutes ?? null,
      resetsAt: typeof window.resets_at === "number" ? new Date(window.resets_at * 1000).toISOString() : null,
    };
  }
  return null;
}

/** Everything Claude needs to pick up where a Codex session stopped. */
export function buildResumePacket(filePath, { threadNames = new Map() } = {}) {
  const lines = rawLines(filePath);
  // Turns Codex replayed from another agent's transcript are not Codex's work.
  const records = parseLines(withoutImportedTurns(lines) ?? lines);
  const meta = records[0]?.type === "session_meta" ? records[0].payload : {};
  const cwd = typeof meta.cwd === "string" ? meta.cwd : null;
  const turns = splitTurns(records.slice(1));
  const last = turns.at(-1) ?? [];

  const status = turnStatus(last);
  const messages = agentMessages(last);
  const finalAnswer = status.kind === "completed" ? finalAnswerOf(last, messages) : null;
  const firstRequest = turns.map(typedRequests).find((requests) => requests.length > 0)?.[0] ?? null;

  return {
    sessionId: meta.id ?? null,
    threadName: threadNames.get(meta.id) ?? null,
    cwd,
    sourcePath: filePath,
    startedAt: meta.timestamp ?? null,
    lastActivityAt: records.findLast((record) => typeof record.timestamp === "string")?.timestamp ?? null,
    status,
    rateLimit: status.kind === "usage_limit" ? latestRateLimit(records) : null,
    originalIntent: firstRequest ? sanitizeString(firstRequest, INTENT_MAX) : null,
    previousTurns: turns
      .slice(0, -1)
      .filter((turn) => turnStatus(turn).kind === "completed")
      .slice(-MAX_PREVIOUS_TURNS)
      .map((turn) => ({
        request: sanitizeString(typedRequests(turn)[0] ?? "", INTENT_MAX),
        answer: sanitizeString(finalAnswerOf(turn, agentMessages(turn)) ?? "", ANSWER_MAX),
      })),
    lastTurn: {
      requests: typedRequests(last),
      commentary: messages
        .filter((message) => message.phase !== "final_answer" && message.text !== finalAnswer)
        .slice(-MAX_COMMENTARY)
        .map((message) => sanitizeString(message.text, COMMENTARY_MAX)),
      finalAnswer: finalAnswer ? sanitizeString(finalAnswer, ANSWER_MAX) : null,
      fileChanges: fileChanges(last, cwd),
      commands: commands(last),
      reasoning: reasoningHeadings(last),
    },
  };
}

const STATUS_LABELS = {
  usage_limit: "사용량 한도에 걸려 턴 도중 멈춤",
  error: "오류로 턴 도중 멈춤",
  aborted: "사용자가 턴을 중단함",
  unfinished: "턴 종료 기록 없음 (진행 중이거나 비정상 종료)",
  completed: "마지막 턴은 정상 완료됨",
};

const CHANGE_LABELS = { add: "추가", update: "수정", delete: "삭제" };

function localTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function inlineCode(text) {
  return text.includes("`") ? `\`\` ${text} \`\`` : `\`${text}\``;
}

function quote(text) {
  return text.split("\n").map((line) => (line ? `> ${line}` : ">")).join("\n");
}

export function renderResumePacket(packet) {
  const { status, rateLimit, lastTurn } = packet;
  const title = packet.threadName ?? packet.originalIntent?.split("\n")[0] ?? packet.sessionId;
  const out = [`# Codex 세션 이어가기: ${title}`, ""];

  out.push(`- 세션 ID: \`${packet.sessionId}\``);
  out.push(`- Codex 작업 폴더: \`${packet.cwd ?? "알 수 없음"}\``);
  if (packet.lastActivityAt) out.push(`- 마지막 활동: ${localTime(packet.lastActivityAt)}`);
  out.push(`- 상태: ${STATUS_LABELS[status.kind]}${status.code ? ` (\`${status.code}\`)` : ""}${status.reason ? ` (${status.reason})` : ""}`);
  if (status.message) out.push(`- Codex 메시지: ${status.message}`);
  if (rateLimit?.resetsAt) {
    const window = rateLimit.windowMinutes ? `${rateLimit.windowMinutes}분 창 ` : "";
    out.push(`- 한도 초기화: ${localTime(rateLimit.resetsAt)} (${window}${rateLimit.usedPercent}% 사용)`);
  }
  out.push(`- 기록 파일: \`${packet.sourcePath}\``);

  const lastRequest = lastTurn.requests[0];
  if (packet.originalIntent && packet.originalIntent !== lastRequest) {
    out.push("", "## 처음 의도", "", quote(packet.originalIntent));
  }

  if (packet.previousTurns.length > 0) {
    out.push("", "## 직전 대화");
    for (const turn of packet.previousTurns) {
      out.push("", "### 요청", "", quote(turn.request), "", "### Codex 답변", "", quote(turn.answer));
    }
  }

  out.push("", "## 마지막 요청", "");
  out.push(lastTurn.requests.length > 0 ? lastTurn.requests.map(quote).join("\n\n") : "(기록 없음)");

  out.push("", "## 마지막 턴 진행 상황");
  if (lastTurn.commentary.length > 0) {
    out.push("", "### Codex 진행 코멘트 (시간순)", "");
    lastTurn.commentary.forEach((text, index) => out.push(`${index + 1}. ${text.replace(/\n+/g, " ")}`));
  }
  if (lastTurn.fileChanges.length > 0) {
    out.push("", "### 바꾼 파일 (apply_patch 기준)", "");
    for (const change of lastTurn.fileChanges) out.push(`- ${CHANGE_LABELS[change.kind] ?? change.kind} ${inlineCode(change.path)}`);
  }
  if (lastTurn.commands.length > 0) {
    out.push("", "### 마지막 명령", "");
    for (const { command, exitCode } of lastTurn.commands) {
      out.push(`- ${inlineCode(command)}${exitCode === null ? "" : ` → 종료 코드 ${exitCode}`}`);
    }
  }
  if (lastTurn.reasoning.length > 0) {
    out.push("", "### 마지막 생각 (요약 제목)", "");
    for (const heading of lastTurn.reasoning) out.push(`- ${heading}`);
  }
  if (lastTurn.finalAnswer) {
    out.push("", "### 최종 답변", "", quote(lastTurn.finalAnswer));
  }

  out.push(
    "",
    "> 참고: 셸 명령(python, sed 등)으로 바꾼 파일은 위 목록에 없을 수 있다. 커밋되지 않은 변경은 Codex 작업 폴더에만 있다.",
  );
  return `${out.join("\n")}\n`;
}
