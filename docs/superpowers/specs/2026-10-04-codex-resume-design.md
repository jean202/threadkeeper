# Codex 세션 Claude 이어가기 (`/codex-resume`) 설계

- 작성일: 2026-10-04
- 상태: 채팅에서 설계 승인됨 (1차: 수동 `/codex-resume`만)
- 동기: Codex 작업이 사용량 한도로 턴 도중 멈추면 리셋(최대 5시간)까지 기다려야 한다. Claude로 바로 넘어가 이어가고 싶은데, 지금 threadkeeper의 핸드오프는 웹에서 카드를 손으로 만드는 흐름이고 내용도 처음 의도와 마지막 메시지 수준이라 "끊긴 지점부터"를 담지 못한다.

## 1. 확인한 사실 (실제 `~/.codex/sessions` 기준)

- 한도 도달은 마지막 `task_complete`에 `error.codex_error_info: "usage_limit_exceeded"`로 남고, 그 직전 `token_count.rate_limits.primary|secondary`에 `used_percent`, `window_minutes`, `resets_at`(epoch 초)가 있다. 실제 기록에서 14번 발생.
- 턴은 `task_started` ~ `task_complete`/`turn_aborted`로 묶이고, 그 안에 `item_completed` 항목이 쌓인다: `UserMessage`, `AgentMessage`(`phase: commentary|final_answer`), `FileChange`(`changes: {경로: {type}}`), `CommandExecution`(`command`, `exit_code`), `Reasoning`(`summary_text`; 본문은 암호화).
- 사용자 요청에 컨텍스트가 붙으면 Codex가 `## My request:` 제목 아래에 실제 입력을 둔다 (앞에는 `<in-app-browser-context ...>` 등).
- 하위 에이전트 세션은 `session_meta.source`가 `{ subagent: ... }` 객체다.
- 반대 방향(Claude → Codex)은 Codex가 자체 지원한다 (`~/.codex/external_agent_session_imports.json`).
- 끊긴 턴의 결과물은 대개 커밋되지 않은 채 Codex 작업 폴더에만 있다. Claude가 새 worktree에서 열리면 보이지 않는다.

## 2. 구성

| 단위 | 역할 |
| --- | --- |
| `agent-state-migrator-bridge/src/codex-resume.js` | 세션 찾기(`findResumeSession`), 재개 패킷 만들기(`buildResumePacket`), markdown 렌더(`renderResumePacket`) |
| `cli.js resume [--cwd] [--session] [--codex-home] [--json]` | 패킷을 stdout에 출력. 세션을 못 찾으면 최근 후보를 stderr에 내고 종료 코드 2 |
| `skills/codex-resume/` | Claude 전역 스킬. `resume.sh`가 심링크를 따라 bridge CLI를 실행 |
| `scripts/install-codex-resume-skill.sh` | `~/.claude/skills/codex-resume` 심링크 생성 |

### 세션 고르기

- `--session <id 일부>`: 파일 이름에 포함되는 가장 최근 rollout.
- 아니면 `--cwd`(기본: 현재 폴더)에서 돌았던 가장 최근 rollout(파일 mtime 기준). 하위 에이전트 세션과, Codex가 가져온 Claude 세션 중 Codex에서 이어 쓰지 않은 것은 건너뛴다. 가져온 세션에서 Codex가 이어 쓴 경우 재생된 `external-import-turn-N` 턴은 패킷에서 뺀다.
- 폴더 비교는 `.claude/worktrees/<name>` 접미사를 떼고 realpath로 맞춘다. Claude 데스크톱이 worktree에서 열려도 같은 프로젝트로 본다.
- `--codex-home`은 import와 같은 의미(세션 루트, 기본 `~/.codex/sessions`)이고, 스레드 이름은 그 부모의 `session_index.jsonl`에서 읽는다.

### 재개 패킷

- 세션 ID, 스레드 이름, Codex 작업 폴더, 마지막 활동 시각, 기록 파일
- 상태: `usage_limit` / `error` / `aborted` / `unfinished`(종료 기록 없음) / `completed`. 한도일 때 리셋 시각·사용률
- 처음 의도, 직전 완료 턴 최대 2개(요청 + 최종 답변)
- 마지막 턴: 요청, 진행 코멘트, 바꾼 파일(`FileChange` 기준, 작업 폴더 상대 경로), 마지막 명령 8개(종료 코드), 마지막 사고 요약 제목 5개, 완료됐으면 최종 답변
- 모든 문자열은 `sanitizeString`으로 길이 상한
- `task_started`가 없는 옛 형식은 파일 전체를 한 턴으로 보고 `response_item`/`event_msg`에서 요청·답변을 읽는다

### 스킬이 Claude에게 시키는 것

1. 패킷 가져오기 (종료 코드 2면 후보를 보여 주고 고르게 한다)
2. Codex 작업 폴더와 현재 폴더가 다르면 알리고 어디서 할지 묻기
3. `git status`/`git diff`로 실제 상태를 패킷과 대조 (셸 명령으로 바꾼 파일은 `FileChange`에 없을 수 있음)
4. 하던 일 / 끝난 것 / 남은 것을 짧게 보고
5. 남은 부분부터 이어서 진행. 되돌리기 어려운 단계(push·배포·삭제)나 모호한 요청은 먼저 묻기

## 3. 비목표 (1차)

- 자동 감지·알림 (2차: enumerator가 `stopReason`/`resetsAt`을 내보내고 기존 Discord 알림 재사용)
- 웹 UI 버튼, Handoff 엔티티 연동
- Claude 세션 JSONL 합성 (`claude --resume`) — 비공개 포맷이라 깨지기 쉽고 토큰 낭비
- `~/.codex/worktrees/...`에서 돈 Codex 세션의 자동 매칭 (`--session`으로 지정)

## 4. 테스트

- `test/codex-resume.test.js`: 한도로 끊긴 턴, 정상 완료·중단·종료 기록 없음, 옛 형식, 렌더 결과(래퍼 문구 제외), 세션 고르기(mtime·worktree·하위 에이전트·id 일부·후보 목록), CLI 종료 코드
- `test/codex-enumerator.test.js`: `## My request:` 제목 뒤를 처음 의도로 읽기
