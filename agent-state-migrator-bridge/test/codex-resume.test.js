import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  ResumeLookupError,
  buildResumePacket,
  findResumeSession,
  readThreadNames,
  renderResumePacket,
} from "../src/codex-resume.js";

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(here, "..", "src", "cli.js");

const CWD = "/Users/dev/work/crepass-admin";
const LIMITED_ID = "01a0e2b5-aaaa-bbbb-cccc-000000000001";

const meta = (id, cwd, extra = {}) => ({
  type: "session_meta",
  payload: { id, timestamp: "2026-10-04T06:00:00.000Z", cwd, originator: "codex_work_desktop", source: "vscode", ...extra },
});
const event = (type, fields = {}) => ({ type: "event_msg", payload: { type, ...fields } });
const item = (fields) => event("item_completed", { item: fields });
const userItem = (text) => item({ type: "UserMessage", content: [{ type: "text", text }] });
const agentItem = (text, phase) => item({ type: "AgentMessage", content: [{ type: "Text", text }], phase });
const command = (script, exitCode) =>
  item({ type: "CommandExecution", command: ["/bin/zsh", "-lc", script], status: exitCode === 0 ? "completed" : "failed", exit_code: exitCode });
const fileChange = (changes) => item({ type: "FileChange", changes, status: "completed" });

const FIRST_ANSWER = "범위를 정리했습니다. 다음 중 고르세요: 1) 버전 비교 2) API 명세";

const FIRST_TURN = [
  event("task_started", { turn_id: "t1" }),
  { type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "<environment_context>\n  <cwd>/x</cwd>\n</environment_context>" }] } },
  userItem("스코어 어드민 작업 범위 정리해줘"),
  agentItem("범위 문서를 읽겠습니다.", "commentary"),
  agentItem(FIRST_ANSWER, "final_answer"),
  event("task_complete", { turn_id: "t1", last_agent_message: FIRST_ANSWER }),
];

// The second turn is the one the usage limit cut off, shaped like a real
// Codex desktop rollout: a context block over "## My request:", commentary,
// patches, commands, and the error on task_complete.
const LIMITED_TURN = [
  event("task_started", { turn_id: "t2" }),
  userItem('\n<in-app-browser-context source="ambient-ui-state">\n- Current URL: http://127.0.0.1:8765/admin.html\n</in-app-browser-context>\n\n## My request:\n응 1 하고 2 해줘\n'),
  agentItem("버전 비교부터 정리하겠습니다.", "commentary"),
  command("git status --short --branch", 0),
  fileChange({ [`${CWD}/ver1/comparison.md`]: { type: "add" } }),
  item({ type: "Reasoning", summary_text: ["**Drafting API specification**"] }),
  item({ type: "Reasoning", summary_text: ["**Drafting API specification**", "**테마 UI를 검증합니다**"] }),
  agentItem("비교표를 작성했고, 지금은 API 명세를 쓰는 중입니다.", "commentary"),
  fileChange({ [`${CWD}/ver1/api-spec.md`]: { type: "add" } }),
  fileChange({ [`${CWD}/ver1/api-spec.md`]: { type: "update" }, [`${CWD}/ADMIN_SCOPE.md`]: { type: "update" } }),
  command("rg -n 'TODO'\n  ver1/api-spec.md", 1),
  event("token_count", {
    rate_limits: {
      limit_id: "codex",
      primary: { used_percent: 98, window_minutes: 300, resets_at: 1791106281 },
      secondary: { used_percent: 31, window_minutes: 10080, resets_at: 1791636882 },
    },
  }),
  event("token_count", { rate_limits: { limit_id: "premium", primary: null, secondary: null } }),
  event("task_complete", {
    turn_id: "t2",
    last_agent_message: null,
    error: { message: "You've hit your usage limit. Try again at 6:31 PM.", codex_error_info: "usage_limit_exceeded" },
  }),
];

const LIMITED = [meta(LIMITED_ID, CWD), ...FIRST_TURN, ...LIMITED_TURN];

/** A turn Codex replayed from another agent's transcript when importing it. */
const importedTurn = (n, request, answer) => [
  event("task_started", { turn_id: `external-import-turn-${n}` }),
  userItem(request),
  agentItem(answer, null),
  event("task_complete", { turn_id: `external-import-turn-${n}`, last_agent_message: null }),
];

/** Writes records as a rollout, stamping each with a later timestamp than the last. */
function writeRollout(dir, name, records, mtime) {
  mkdirSync(dir, { recursive: true });
  const base = Date.parse("2026-10-04T06:00:00.000Z");
  const lines = records.map((record, index) => JSON.stringify({ timestamp: new Date(base + index * 1000).toISOString(), ...record }));
  const file = path.join(dir, name);
  writeFileSync(file, `${lines.join("\n")}\n`);
  if (mtime) utimesSync(file, mtime, mtime);
  return file;
}

function tempRollout(records) {
  return writeRollout(mkdtempSync(path.join(tmpdir(), "codex-resume-")), "rollout-test.jsonl", records);
}

/** A ~/.codex-shaped home: sessions/YYYY/MM/DD/rollout-*.jsonl plus session_index.jsonl. */
function codexHome() {
  const home = mkdtempSync(path.join(tmpdir(), "codex-home-"));
  const day = path.join(home, "sessions", "2026", "10", "04");
  const at = (minute) => new Date(`2026-10-04T06:${String(minute).padStart(2, "0")}:00.000Z`);
  writeRollout(day, "rollout-2026-10-04T05-00-00-old0aaaa-0000.jsonl", [meta("old0aaaa-0000", CWD), ...FIRST_TURN], at(10));
  writeRollout(day, `rollout-2026-10-04T06-00-00-${LIMITED_ID}.jsonl`, LIMITED, at(20));
  writeRollout(day, "rollout-2026-10-04T06-30-00-else1111-0000.jsonl", [meta("else1111-0000", "/Users/dev/work/elsewhere"), ...FIRST_TURN], at(30));
  writeRollout(
    day,
    "rollout-2026-10-04T06-40-00-sub22222-0000.jsonl",
    [meta("sub22222-0000", CWD, { source: { subagent: { thread_spawn: { parent_thread_id: LIMITED_ID } } } }), ...FIRST_TURN],
    at(40),
  );
  // A Claude session Codex imported: the newest in the folder, but Codex never ran it.
  writeRollout(day, "rollout-2026-10-04T06-50-00-imp33333-0000.jsonl", [meta("imp33333-0000", CWD), ...importedTurn(1, "리뷰해줘", "문제 없음")], at(50));
  writeFileSync(
    path.join(home, "session_index.jsonl"),
    [
      { id: LIMITED_ID, thread_name: "어드민 범위", updated_at: "2026-10-04T06:00:00Z" },
      { id: LIMITED_ID, thread_name: "스코어 서비스 어드민 작업 범위 확인", updated_at: "2026-10-04T06:20:00Z" },
    ].map((entry) => JSON.stringify(entry)).join("\n"),
  );
  return { home, sessions: path.join(home, "sessions") };
}

test("builds a resume packet for a turn the usage limit cut off", () => {
  const packet = buildResumePacket(tempRollout(LIMITED));

  assert.equal(packet.sessionId, LIMITED_ID);
  assert.equal(packet.cwd, CWD);
  assert.deepEqual(packet.status, {
    kind: "usage_limit",
    code: "usage_limit_exceeded",
    message: "You've hit your usage limit. Try again at 6:31 PM.",
  });
  // The 5-hour window is the fuller one, so it is the one that ran out.
  assert.deepEqual(packet.rateLimit, { usedPercent: 98, windowMinutes: 300, resetsAt: "2026-10-04T09:31:21.000Z" });
  assert.equal(packet.originalIntent, "스코어 어드민 작업 범위 정리해줘");
  assert.deepEqual(packet.previousTurns, [{ request: "스코어 어드민 작업 범위 정리해줘", answer: FIRST_ANSWER }]);
  assert.deepEqual(packet.lastTurn.requests, ["응 1 하고 2 해줘"]);
  assert.equal(packet.lastTurn.finalAnswer, null);
});

test("lists what the cut-off turn said, changed and ran", () => {
  const { lastTurn } = buildResumePacket(tempRollout(LIMITED));

  assert.deepEqual(lastTurn.commentary, ["버전 비교부터 정리하겠습니다.", "비교표를 작성했고, 지금은 API 명세를 쓰는 중입니다."]);
  // Relative to the Codex folder; a file added then edited is still "add".
  assert.deepEqual(lastTurn.fileChanges, [
    { path: "ver1/comparison.md", kind: "add" },
    { path: "ver1/api-spec.md", kind: "add" },
    { path: "ADMIN_SCOPE.md", kind: "update" },
  ]);
  assert.deepEqual(lastTurn.commands, [
    { command: "git status --short --branch", exitCode: 0 },
    { command: "rg -n 'TODO' ver1/api-spec.md", exitCode: 1 },
  ]);
  assert.deepEqual(lastTurn.reasoning, ["Drafting API specification", "테마 UI를 검증합니다"]);
});

test("reports a finished last turn with its final answer, not as commentary", () => {
  const packet = buildResumePacket(tempRollout([meta(LIMITED_ID, CWD), ...FIRST_TURN]));

  assert.deepEqual(packet.status, { kind: "completed" });
  assert.equal(packet.rateLimit, null);
  assert.deepEqual(packet.previousTurns, []);
  assert.equal(packet.lastTurn.finalAnswer, FIRST_ANSWER);
  assert.deepEqual(packet.lastTurn.commentary, ["범위 문서를 읽겠습니다."]);
});

test("tells a turn the user interrupted from one that never recorded an end", () => {
  const started = [meta(LIMITED_ID, CWD), event("task_started", { turn_id: "t1" }), userItem("고쳐줘")];

  const aborted = buildResumePacket(tempRollout([...started, event("turn_aborted", { turn_id: "t1", reason: "interrupted" })]));
  assert.deepEqual(aborted.status, { kind: "aborted", reason: "interrupted" });

  const unfinished = buildResumePacket(tempRollout(started));
  assert.deepEqual(unfinished.status, { kind: "unfinished" });
  assert.deepEqual(unfinished.lastTurn.requests, ["고쳐줘"]);
});

test("reads a rollout with no turn events as one turn of response_items", () => {
  const packet = buildResumePacket(path.join(here, "fixtures", "codex", "response-items-only.jsonl"));

  assert.deepEqual(packet.status, { kind: "unfinished" });
  assert.deepEqual(packet.lastTurn.requests, ["녹음 내용 녹취한 것 중에 강수창 발언만 추려줘"]);
  assert.deepEqual(packet.lastTurn.commentary, ["발언 12개를 찾았어요. 다음으로 시간순으로 정리할게요."]);
});

test("renders the packet for Claude without the context Codex wrapped around the prompt", () => {
  const markdown = renderResumePacket(buildResumePacket(tempRollout(LIMITED), { threadNames: new Map([[LIMITED_ID, "스코어 서비스 어드민 작업 범위 확인"]]) }));

  assert.match(markdown, /^# Codex 세션 이어가기: 스코어 서비스 어드민 작업 범위 확인/);
  assert.match(markdown, new RegExp(`Codex 작업 폴더: \`${CWD}\``));
  assert.match(markdown, /사용량 한도/);
  assert.match(markdown, /Try again at 6:31 PM/);
  assert.match(markdown, /응 1 하고 2 해줘/);
  assert.match(markdown, /추가 `ver1\/api-spec\.md`/);
  assert.match(markdown, /`rg -n 'TODO' ver1\/api-spec\.md` → 종료 코드 1/);
  assert.doesNotMatch(markdown, /in-app-browser-context|environment_context|## My request/);
});

test("picks the latest session that ran in the folder, skipping sub-agent and imported sessions", () => {
  const { sessions } = codexHome();
  const file = findResumeSession({ sessionsRoot: sessions, cwd: CWD });
  assert.equal(path.basename(file), `rollout-2026-10-04T06-00-00-${LIMITED_ID}.jsonl`);
});

test("treats a Claude worktree of the project as the project", () => {
  const { sessions } = codexHome();
  const file = findResumeSession({ sessionsRoot: sessions, cwd: `${CWD}/.claude/worktrees/peaceful-tesla` });
  assert.equal(path.basename(file), `rollout-2026-10-04T06-00-00-${LIMITED_ID}.jsonl`);
});

test("finds a session by part of its id, wherever it ran", () => {
  const { sessions } = codexHome();
  const file = findResumeSession({ sessionsRoot: sessions, cwd: CWD, session: "else1111" });
  assert.equal(path.basename(file), "rollout-2026-10-04T06-30-00-else1111-0000.jsonl");
});

test("lists recent sessions when none ran in the folder", () => {
  const { sessions } = codexHome();
  assert.throws(
    () => findResumeSession({ sessionsRoot: sessions, cwd: "/Users/dev/work/nowhere" }),
    (error) => {
      assert.ok(error instanceof ResumeLookupError);
      assert.deepEqual(error.candidates.map((c) => c.id), ["else1111-0000", LIMITED_ID, "old0aaaa-0000"]);
      assert.equal(error.candidates[0].cwd, "/Users/dev/work/elsewhere");
      return true;
    },
  );
});

test("leaves the turns Codex imported from another agent out of the packet", () => {
  const packet = buildResumePacket(
    tempRollout([meta(LIMITED_ID, CWD), ...importedTurn(1, "Claude에게 한 요청", "Claude의 답"), ...FIRST_TURN, ...LIMITED_TURN]),
  );
  assert.equal(packet.originalIntent, "스코어 어드민 작업 범위 정리해줘");
  assert.deepEqual(packet.previousTurns.map((turn) => turn.request), ["스코어 어드민 작업 범위 정리해줘"]);
  assert.deepEqual(packet.lastTurn.requests, ["응 1 하고 2 해줘"]);
});

test("does not offer an imported session nobody went on with in Codex, even by id", () => {
  const { sessions } = codexHome();
  assert.throws(() => findResumeSession({ sessionsRoot: sessions, cwd: CWD, session: "imp33333" }), ResumeLookupError);
});

test("reads thread names from session_index.jsonl, the latest rename winning", () => {
  const { home } = codexHome();
  const names = readThreadNames(path.join(home, "session_index.jsonl"));
  assert.equal(names.get(LIMITED_ID), "스코어 서비스 어드민 작업 범위 확인");
  assert.equal(readThreadNames(path.join(home, "missing.jsonl")).size, 0);
});

test("cli resume prints the packet for the session that ran in --cwd", async () => {
  const { sessions } = codexHome();
  const { stdout } = await execFileAsync("node", [cliPath, "resume", "--codex-home", sessions, "--cwd", CWD]);
  assert.match(stdout, /^# Codex 세션 이어가기: 스코어 서비스 어드민 작업 범위 확인/);
  assert.match(stdout, /응 1 하고 2 해줘/);
});

test("cli resume exits 2 with the recent sessions when none ran in --cwd", async () => {
  const { sessions } = codexHome();
  await assert.rejects(
    execFileAsync("node", [cliPath, "resume", "--codex-home", sessions, "--cwd", "/Users/dev/work/nowhere"]),
    (error) => {
      assert.equal(error.code, 2);
      assert.match(error.stderr, /\/Users\/dev\/work\/nowhere/);
      assert.match(error.stderr, new RegExp(`${LIMITED_ID}.*스코어 서비스 어드민 작업 범위 확인`));
      return true;
    },
  );
});
