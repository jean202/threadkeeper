# ThreadKeeper ← portfolio-tracker 준비도 배지 전시 설계

- 작성일: 2026-06-03
- 방향: **PT → TK (얕은 읽기전용 전시)** — portfolio-tracker가 계산한 프로젝트 준비도(readiness)를 ThreadKeeper 웹에서 thread 옆에 읽기전용 배지로 표시
- 상태: 설계 승인됨, 구현 계획 작성 대기
- 관련: `~/portfolio/portfolio-tracker/docs/superpowers/specs/2026-06-02-threadkeeper-portfolio-integration-design.md` (반대 방향 TK→PT, 이미 머지)

## 1. 목표와 경계 원칙

ThreadKeeper 웹에서 thread/프로젝트를 볼 때, 그 프로젝트의 portfolio-tracker 준비도를 **읽기전용 배지/컨텍스트**로 보여준다. 예: thread 카드에 "82% · 3일 전".

### 절대 원칙 (경계 유지)

- **TK는 준비도를 계산하거나 소유하지 않는다.** PT가 만든 JSON 값을 **읽어서 그대로 전시(display)만** 한다. GitHub이 외부 CI 상태 배지를 보여주는 것과 같은 수준.
- 즉 **얕고, 읽기전용이고, 참조일 뿐**이어야 한다. PT의 점수 로직·버킷·곡선·대시보드를 TK 안에 재구현하기 시작하면 = 과합침(경계 붕괴). 그 신호가 보이면 멈추고 사용자에게 알린다.
- **비대칭 유지**: TK→PT 방향이 읽기전용이었듯(소비자 PT가 TK REST를 읽고, `enabled` 기본 off, graceful degrade), PT→TK도 똑같이 얕게. 여기서는 역할이 뒤집혀 **소비자/전시자 = TK, 생산자 = PT**.

### 비목표 (YAGNI)

- TK에서 readiness 점수를 **계산/재계산/가중**하지 않는다. PT 값을 그대로 통과시킨다.
- PT로 가는 **하이퍼링크는 만들지 않는다** (가정 A, §7). PT는 순수 CLI라 볼 수 있는 웹 화면이 없다. 참조는 텍스트 라벨로만.
- PT 데이터를 TK DB에 **저장하지 않는다** (push/쓰기 표면 없음). 매 요청 시 파일을 읽는다(+mtime 캐시).
- projectKey override 맵은 만들지 않는다. **정확 일치만** (§4). 실제 불일치 사례가 생기면 그때 추가.
- 프로젝트 단위 그룹 뷰 신규 페이지는 만들지 않는다(PT 대시보드 역할과 겹쳐 경계 붕괴 위험).

## 2. 데이터 전달 경로 (결정: 방향 a)

PT는 서버가 없다. `export -f json -o <path>`로 약속된 경로에 스캔 JSON을 쓴다. **TK-api가 그 파일을 읽어** project→projectKey로 매핑하고, 읽기전용 엔드포인트로 노출한다. TK-web은 표시만 한다.

- PT 코드 변경 없음 (export 경로만 그 위치로 맞추면 됨 — 운영 설정, 이 레포 범위 밖).
- TK에 쓰기/저장 표면 추가 없음.
- 소비자(TK)가 읽기 + 캐시 + graceful degrade를 **한 컴포넌트(api `portfolio` 패키지)에 가둔다.**

## 3. 응답 구조 (결정: 별도 읽기전용 리소스)

PT 전시 데이터는 Thread와 **완전히 분리된 자기 리소스**로 둔다. Thread DTO는 변경하지 않는다.

```
GET /api/v1/portfolio-readiness
→ 200 [ { projectKey, readiness, baseReadiness, scannedAt, stale, ageDays }, ... ]
```

- 전체 프로젝트 맵(배열)을 반환. 웹은 이걸 한 번 fetch해 `projectKey`로 인덱싱한다.
- 단건 `/{projectKey}` 엔드포인트는 만들지 않는다 (웹이 맵을 인덱싱하므로 불필요, YAGNI).
- "GitHub 외부 CI 배지" 모델과 동일: PT 전시 데이터는 Thread와 별개의 네임스페이스.

## 4. TK-api 설계 (신규 feature 패키지 `com.jean325.threadkeeper.portfolio`)

기존 package-by-feature + `@ConfigurationProperties` + `ApiException` 패턴을 따른다.

### 신규 파일

| 파일 | 책임 | 의존 |
|---|---|---|
| `portfolio/domain/PortfolioProperties.java` | `@ConfigurationProperties("threadkeeper.portfolio")` — `enabled`(기본 false), `jsonPath`(기본 빈 값), `staleMaxDays`(기본 14). NotificationProperties 패턴 미러. | — |
| `portfolio/application/PortfolioScanFileReader.java` | `jsonPath`의 PT JSON을 **읽고 파싱만**. 파일 없음 / 읽기 실패 / JSON 깨짐 → 빈 결과(예외 던지지 않음). 파일 mtime 기반 인메모리 캐시(mtime 변할 때만 재파싱). | Jackson, `PortfolioProperties` |
| `portfolio/application/PortfolioReadinessService.java` | reader 결과(PT projects[])를 `name`(정규화) → `PortfolioReadinessResponse` 맵으로 변환. `staleMaxDays`로 `stale`/`ageDays` 계산. `enabled=false`면 빈 리스트. | `PortfolioScanFileReader`, `PortfolioProperties`, `Clock` |
| `portfolio/api/PortfolioReadinessController.java` | `GET /api/v1/portfolio-readiness` → `List<PortfolioReadinessResponse>`. | `PortfolioReadinessService` |
| `portfolio/dto/PortfolioReadinessResponse.java` | record `{ String projectKey, int readiness, int baseReadiness, Instant scannedAt, boolean stale, long ageDays }` | — |

### PT JSON에서 읽는 필드 (그대로 통과)

PT `scan-result.json`의 `projects[]` 각 항목에서:
- `name` → `projectKey` 매칭에 사용 (정규화: trim + 소문자)
- `readiness` (최종 점수, 그대로)
- `baseReadiness` (그대로)
- `scannedAt` (ISO timestamp → `Instant`)

TK는 이 값들을 **해석/재계산하지 않고** 통과시킨다. (`continuity`, `progress`, `signals` 등 나머지 PT 내부 필드는 읽지 않는다 — 전시 범위 밖.)

### application.yml 추가

```yaml
threadkeeper:
  portfolio:
    enabled: ${THREADKEEPER_PORTFOLIO_ENABLED:false}
    json-path: ${THREADKEEPER_PORTFOLIO_JSON_PATH:}   # 예: /Users/.../portfolio-tracker/.portfolio-tracker/scan-result.json
    stale-max-days: 14
```

### 매칭 규칙

- PT `name`과 TK `thread.projectKey`가 **정규화 후 정확 일치**할 때만 매핑.
- 일치 없으면 그 projectKey는 응답 맵에 없음 → 웹에서 배지 생략.

## 5. TK-web 설계

| 파일 | 책임 |
|---|---|
| `src/types/portfolio.ts` | `PortfolioReadiness` 인터페이스 (`projectKey`, `readiness`, `baseReadiness`, `scannedAt`, `stale`, `ageDays`). |
| `src/api/client.ts` (변경) | `getPortfolioReadiness(): Promise<Map<string, PortfolioReadiness>>` 추가. 호출 실패 시 **빈 맵 반환(catch)** → 배지 전체 생략, thread는 정상 렌더. |
| `src/components/PortfolioReadinessBadge.tsx` (신규) | 순수 표시 컴포넌트. props로 `PortfolioReadiness | undefined`. `82% · 3일 전` 표시, `stale`이면 흐리게 + `(stale)` 표기. `undefined`면 `null` 렌더(아무것도 안 보임). |
| `src/pages/index.tsx` (변경) | thread 목록과 readiness 맵을 **병렬 fetch**. 각 행에 `thread.projectKey`로 골라 `<PortfolioReadinessBadge>` 렌더. |
| `src/pages/threads/[threadId].tsx` (변경) | thread 상세 로드 시 readiness 맵도 fetch. Overview 섹션 근처에 `thread.projectKey`로 골라 배지 1개 렌더. |

### 배지 표시 형식

- 값 있음 & 신선: `포트폴리오 준비도 82% · 3일 전` (+ 텍스트 라벨 `portfolio-tracker`)
- 값 있음 & stale (ageDays > staleMaxDays): 흐린 스타일 + `82% · 21일 전 (stale)`
- 값 없음 (projectKey 미존재 / 파일 없음 / api 실패 / enabled=false): **아무것도 표시 안 함** (조용히 생략)

## 6. 에러 / Graceful Degradation

다음은 전부 **빈 맵 = 배지 없음**으로 귀결되며, 예외를 클라이언트로 던지지 않는다. thread UI는 항상 정상 동작한다.

- `enabled=false` (기본값)
- `jsonPath` 비었거나 파일 없음
- 파일 읽기 실패 / JSON 파싱 실패
- api 자체가 다운 (웹 client가 catch → 빈 맵)
- projectKey가 PT JSON에 없음

신선도: PT 값이 오래되면 숨기지 않고 `stale` 플래그 + `ageDays`로 **표시하되 흐리게**. (값을 신선한 척 보여주지 않음.)

## 7. 가정 (승인됨)

- **(가정 A) "PT로 가는 참조"는 하이퍼링크가 아님.** PT는 순수 CLI라 웹 URL이 없다. 참조는 텍스트 라벨(`portfolio-tracker · scanned 3d ago` 수준)로만 둔다. 향후 PT에 볼 수 있는 화면(예: 모바일/뷰어 앱)이 생기면 그때 링크를 추가한다(YAGNI).
- **(가정 B) `jsonPath`는 사용자가 설정으로 1회 지정** (기본 빈 값 = 비활성). PT가 그 경로로 export하도록 맞추는 것은 PT 쪽 운영이며 이 레포 범위 밖(코드 변경 아님).
- **(태도) "일단 해보고 불편하면 바꾼다"** — 1차 구현은 위 최소 형태로. 배지 위치/형식/신선도 임계는 실사용 후 조정.

## 8. 테스트 전략

### api
- `PortfolioScanFileReader`: 정상 파일 파싱 / 파일 없음 → 빈 결과 / 깨진 JSON → 빈 결과 / mtime 변경 시 재읽기, 불변 시 캐시 사용.
- `PortfolioReadinessService`: `name` 정규화 매핑(trim/대소문자), `stale`/`ageDays` 경계(staleMaxDays 전후), `enabled=false` → 빈 리스트, 누락 필드 graceful.
- `PortfolioReadinessController`: MockMvc로 200 + 리스트 반환, enabled=false 시 빈 리스트.

### web
- `PortfolioReadinessBadge`: 신선 값 렌더(% + 나이), stale 스타일, `undefined`면 `null`.
- `client.getPortfolioReadiness`: 정상 → Map 빌드, 실패 → 빈 Map.

## 9. 미해결 / 1차 구현에서 확정

- PT `scan-result.json`의 `readiness`/`baseReadiness`/`scannedAt`/`name` 필드 존재를 가정(샘플로 확인됨). 구현 첫 단계에서 실제 스키마 재확인.
- `scannedAt`은 프로젝트별 필드(샘플 확인). 파일 전체에 top-level 생성 시각이 별도로 있으면 그걸 fallback으로 쓸지 구현 시 결정.
- 배지의 정확한 시각 디자인(색/위치)은 1차 구현 후 조정.
