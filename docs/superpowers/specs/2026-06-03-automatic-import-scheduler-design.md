# 자동 import 스케줄러 설계 (staleness catch-up)

- 작성일: 2026-06-03
- 상태: 설계 승인됨, 구현 계획 작성 대기
- 동기: ThreadKeeper 웹(:3000)이 며칠째 같은 내용을 보여줌. 원인은 웹/캐시가 아니라 **import가 6/1 이후 안 돌아 DB가 멈춰 있는 것**. import는 현재 수동 트리거(`POST .../imports/run`)뿐이고 자동 스케줄러가 없음.

## 1. 목표

api가 떠 있는 동안 주기적으로 점검하여, 설정된 provider 연결 1개의 마지막 성공 import가 오래됐으면 자동으로 import를 실행한다. 노트북이 스케줄 시각에 잠들어 있거나 api가 꺼져 있어도, 깨어나면 다음 점검에서 따라잡는다(catch-up). 사실상 "하루 1회"로 수렴한다.

### 핵심 결정 (왜 이 모양인가)

- **cadence = 하루 1회**, 단 노트북 환경이라 cron-at-time(특정 시각 1회)은 그 시각에 잠/꺼짐이면 그날을 건너뛴다. 그래서 **fixedDelay 주기 점검 + staleness 임계**로 자가 치유한다.
- **연결 1개 + `target="codex,claude"`** (현재 검증된 수동 방식 그대로). 데이터 모델상 dedup은 `(connection, providerSessionKey)` 단위이므로, **각 provider는 정확히 한 연결에서만 수집**되어야 중복이 없다. 연결 여러 개를 같은 target으로 돌리면 세션이 연결마다 중복 import된다.
- **import 로직은 재사용**: 기존 `ProviderConnectionService.runImport()`/`listConnections()`를 그대로 호출 → 로직 중복 0.

### 비목표 (YAGNI)

- 여러 연결 동시 import / provider별 연결 분리 — 범위 밖(단일 연결 + 합친 target).
- 자동 thread 병합·중복 thread 정리 — 범위 밖(별개 작업).
- 실패 시 Discord 알림 — 범위 밖(로그 + 기존 `lastErrorMessage`로 충분).
- import 전용 별도 스레드풀 — 범위 밖(기본 단일 스레드 스케줄러 허용).
- 외부 launchd/cron 방식 — 채택 안 함(인앱 스케줄러로 결정).

## 2. 현재 동작 (코드 확인 결과, 설계 전제)

- `runImport`은 `@Transactional`. 성공 시 `connection.markImported()`가 `lastImportAt=now`, `lastErrorMessage=null` 설정. **실패 시 트랜잭션 롤백** → `lastImportAt` 그대로(실패는 DB에 남지 않음).
- 따라서 catch-up이 `lastImportAt`만 보면 실패한 연결을 매 점검마다 재시도하게 됨 → 스케줄러가 **인메모리 "마지막 시도 시각"**을 함께 추적해 임계 내 재시도를 막는다.
- `runImport`은 connectionId + `RunProviderImportRequest(migratorPath, bridgePath, profile, target, includeSensitive)`를 받는다. 자동 실행은 이 값들을 config에서 채운다.
- `listConnections()`는 `id, provider, status, lastImportAt`을 포함하는 `ProviderConnectionResponse` 목록을 반환 → 스케줄러가 별도 repository 없이 대상 연결 정보를 얻는다.

## 3. 구성요소 (기존 `NotificationAutomationScheduler` 패턴 미러)

### 신규 파일

- `provider/application/ImportSchedulerProperties.java`
  - `@ConfigurationProperties(prefix = "threadkeeper.import-scheduler")`
  - 필드/기본값: `enabled=false`, `connectionId=1`, `target="codex,claude"`, `migratorPath=""`, `bridgePath=""`, `profile="full"`, `includeSensitive=false`, `checkDelayMs=3600000`, `stalenessThresholdHours=20`.

- `provider/application/AutomaticImportScheduler.java` (`@Component`)
  - 의존: `ProviderConnectionService`, `ImportSchedulerProperties`, `Clock`(기존 빈 재사용).
  - 인메모리 상태: `Instant lastAttempt`(설정 연결 1개라 단일 필드면 충분; 단순/명확).
  - `@Scheduled(initialDelayString = "${threadkeeper.import-scheduler.check-delay-ms:3600000}", fixedDelayString = "${threadkeeper.import-scheduler.check-delay-ms:3600000}")` 메서드 `runDueImport()`:
    1. `!enabled` → return.
    2. `migratorPath` blank → 경고 로그 1회 성격으로 남기고 return.
    3. `listConnections()`에서 `connectionId` 찾기. 없거나 `status != ACTIVE` → 경고 로그 + return.
    4. should-run 판정(§4). 아니면 return.
    5. `lastAttempt = clock.instant()` 기록.
    6. `try { providerConnectionService.runImport(connectionId, request) ; 성공 로그 }`
       `catch (Exception e) { 실패 로그(스케줄러는 계속 살아 있음) }`
       - `request = new RunProviderImportRequest(migratorPath, bridgePath, profile, target, includeSensitive)`.

### 변경 파일

- `global/config/`의 설정 클래스(예: 신규 `ImportSchedulerConfig` 또는 기존 config 확장)에 `@EnableConfigurationProperties(ImportSchedulerProperties.class)` 추가. (기존 `NotificationConfig`/`PortfolioConfig` 패턴 따름)
- `src/main/resources/application.yml`: 아래 블록 추가(`threadkeeper:` 하위, 기존 `notifications:`/`portfolio:` 형제):
  ```yaml
  import-scheduler:
    enabled: ${THREADKEEPER_IMPORT_ENABLED:false}
    connection-id: ${THREADKEEPER_IMPORT_CONNECTION_ID:1}
    target: ${THREADKEEPER_IMPORT_TARGET:codex,claude}
    migrator-path: ${THREADKEEPER_IMPORT_MIGRATOR_PATH:}
    bridge-path: ${THREADKEEPER_IMPORT_BRIDGE_PATH:}
    profile: ${THREADKEEPER_IMPORT_PROFILE:full}
    include-sensitive: ${THREADKEEPER_IMPORT_INCLUDE_SENSITIVE:false}
    check-delay-ms: ${THREADKEEPER_IMPORT_CHECK_DELAY_MS:3600000}
    staleness-threshold-hours: ${THREADKEEPER_IMPORT_STALENESS_HOURS:20}
  ```

## 4. should-run 판정 (단일 연결)

```
now = clock.instant()
threshold = Duration.ofHours(stalenessThresholdHours)
importStale  = conn.lastImportAt == null || conn.lastImportAt.isBefore(now - threshold)
attemptStale = lastAttempt == null       || lastAttempt.isBefore(now - threshold)
shouldRun = importStale && attemptStale
```

- 성공하면 `lastImportAt`이 갱신되어 다음 임계 창까지 자연히 쉰다 → 하루 1회 수렴.
- 실패하면 `lastImportAt`은 안 바뀌지만 `lastAttempt` 때문에 임계 내 재시도하지 않는다(폭주 방지). 임계가 지나면 다시 1회 시도.
- 재시작 시 `lastAttempt`는 초기화(null) → 부팅 후 첫 점검에서 stale이면 1회 시도(의도된 동작).

## 5. 에러 처리 / 동시성

- 연결별(여기선 1개) `try/catch` + 로그. 예외가 스케줄러 스레드를 죽이지 않는다.
- Spring 기본 스케줄러는 단일 스레드 → `@Scheduled` 메서드끼리 동시 실행되지 않음(import 중복 실행 없음). 단 긴 import가 도는 동안 알림 스케줄러 틱이 잠깐 지연될 수 있음 — 개인용 단일 사용자 전제로 허용. (전용 executor 분리는 후속 YAGNI.)
- `enabled=false`(기본값)이면 스케줄러는 아무 일도 하지 않음 → 기존 동작과 완전히 동일.

## 6. 테스트 전략

- `ImportSchedulerProperties`: 기본값 바인딩 확인(또는 스케줄러 테스트에서 간접 검증).
- `AutomaticImportScheduler` (단위 테스트, mock `ProviderConnectionService` + 고정 `Clock`):
  - `enabled=false` → `runImport` 0회.
  - `migratorPath` 빈 값 → `runImport` 0회.
  - `connectionId`에 해당하는 연결 없음 / `status != ACTIVE` → 0회.
  - `lastImportAt == null` → 1회 호출, 인자 검증(`connectionId`, `target="codex,claude"`, `migratorPath` 등 전달).
  - `lastImportAt`이 최근(<임계) → 미호출.
  - `lastImportAt`이 오래됨(>임계) → 호출.
  - 임계 내 두 번째 점검 → 재시도 안 함(인메모리 `lastAttempt`).
  - `runImport`이 예외를 던져도 스케줄러 메서드가 정상 반환(죽지 않음).
- mock 방법: `ProviderConnectionService`를 Mockito mock으로 두고 `listConnections()` 반환값과 `runImport(...)` 동작(정상/예외)을 스텁. `Clock.fixed(...)`로 시간 고정.

## 7. 가정 / 확인됨

- 기본 `connectionId=1`(현재 CODEX 연결)에서 `target="codex,claude"`로 양쪽 provider 세션을 모두 수집한다(사용자 승인). CLAUDE 연결(id2)은 미사용으로 둔다.
- `migratorPath`/`bridgePath`는 머신별 경로이므로 env로 주입(기본 빈 값 = 사실상 비활성 안전장치).
- 이 작업은 thread "세션당 생성/중복" 문제를 해결하지 않는다(별개 범위). 자동 import는 단지 현재 수동 흐름을 주기적으로 대신 돌릴 뿐이다.
