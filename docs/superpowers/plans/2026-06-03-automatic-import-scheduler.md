# Automatic Import Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app scheduler that periodically re-runs the proven manual import (single connection, `target=codex,claude`) when the last successful import is older than a staleness threshold, so the ThreadKeeper web stops showing days-old data.

**Architecture:** A `@Scheduled` component (`AutomaticImportScheduler`) checks every `checkDelayMs` (default 1h). When enabled and the configured connection's `lastImportAt` is older than `stalenessThresholdHours` (default 20h), it calls the existing `ProviderConnectionService.runImport(...)` with params from config. An in-memory `lastAttempt` timestamp prevents retry storms on failure (failed imports roll back and don't update `lastImportAt`). Robust to laptop sleep: a missed window is caught up on the next check after wake. Default disabled. Mirrors the existing `NotificationAutomationScheduler` + `@ConfigurationProperties` patterns.

**Tech Stack:** Spring Boot (Java 17), JUnit 5 + Mockito + AssertJ (via spring-boot-starter-test). Reuses the existing `Clock` bean from `PortfolioConfig`.

**Spec:** `docs/superpowers/specs/2026-06-03-automatic-import-scheduler-design.md`

---

## File Structure

- `provider/application/ImportSchedulerProperties.java` (new) — `@ConfigurationProperties("threadkeeper.import-scheduler")` config holder.
- `global/config/ImportSchedulerConfig.java` (new) — `@EnableConfigurationProperties(ImportSchedulerProperties.class)` (mirrors `NotificationConfig`/`PortfolioConfig`).
- `provider/application/AutomaticImportScheduler.java` (new) — the scheduled component.
- `src/main/resources/application.yml` (modify) — add `threadkeeper.import-scheduler` block.
- Tests:
  - `provider/application/ImportSchedulerPropertiesTest.java` (new) — defaults.
  - `provider/application/AutomaticImportSchedulerTest.java` (new) — behavior (mock service + fixed Clock).

---

## Task 1: Config (properties + registration + yml)

**Files:**
- Create: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/application/ImportSchedulerProperties.java`
- Create: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/global/config/ImportSchedulerConfig.java`
- Test: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/application/ImportSchedulerPropertiesTest.java`
- Modify: `threadkeeper-api/src/main/resources/application.yml`

- [ ] **Step 1: Write the failing defaults test**

`threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/application/ImportSchedulerPropertiesTest.java`:
```java
package com.jean325.threadkeeper.provider.application;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ImportSchedulerPropertiesTest {

    @Test
    void hasSafeDefaults() {
        ImportSchedulerProperties p = new ImportSchedulerProperties();
        assertThat(p.isEnabled()).isFalse();
        assertThat(p.getConnectionId()).isEqualTo(1L);
        assertThat(p.getTarget()).isEqualTo("codex,claude");
        assertThat(p.getProfile()).isEqualTo("full");
        assertThat(p.isIncludeSensitive()).isFalse();
        assertThat(p.getCheckDelayMs()).isEqualTo(3_600_000L);
        assertThat(p.getStalenessThresholdHours()).isEqualTo(20L);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jean325/portfolio/projects/threadkeeper/threadkeeper-api && ./gradlew test --tests "*ImportSchedulerPropertiesTest"`
Expected: FAIL — `ImportSchedulerProperties` does not exist (compile error).

- [ ] **Step 3: Create ImportSchedulerProperties**

`threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/application/ImportSchedulerProperties.java`:
```java
package com.jean325.threadkeeper.provider.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "threadkeeper.import-scheduler")
public class ImportSchedulerProperties {

    private boolean enabled = false;
    private long connectionId = 1;
    private String target = "codex,claude";
    private String migratorPath = "";
    private String bridgePath = "";
    private String profile = "full";
    private boolean includeSensitive = false;
    private long checkDelayMs = 3_600_000L;
    private long stalenessThresholdHours = 20;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public long getConnectionId() {
        return connectionId;
    }

    public void setConnectionId(long connectionId) {
        this.connectionId = connectionId;
    }

    public String getTarget() {
        return target;
    }

    public void setTarget(String target) {
        this.target = target;
    }

    public String getMigratorPath() {
        return migratorPath;
    }

    public void setMigratorPath(String migratorPath) {
        this.migratorPath = migratorPath;
    }

    public String getBridgePath() {
        return bridgePath;
    }

    public void setBridgePath(String bridgePath) {
        this.bridgePath = bridgePath;
    }

    public String getProfile() {
        return profile;
    }

    public void setProfile(String profile) {
        this.profile = profile;
    }

    public boolean isIncludeSensitive() {
        return includeSensitive;
    }

    public void setIncludeSensitive(boolean includeSensitive) {
        this.includeSensitive = includeSensitive;
    }

    public long getCheckDelayMs() {
        return checkDelayMs;
    }

    public void setCheckDelayMs(long checkDelayMs) {
        this.checkDelayMs = checkDelayMs;
    }

    public long getStalenessThresholdHours() {
        return stalenessThresholdHours;
    }

    public void setStalenessThresholdHours(long stalenessThresholdHours) {
        this.stalenessThresholdHours = stalenessThresholdHours;
    }
}
```

- [ ] **Step 4: Create ImportSchedulerConfig (register properties)**

`threadkeeper-api/src/main/java/com/jean325/threadkeeper/global/config/ImportSchedulerConfig.java`:
```java
package com.jean325.threadkeeper.global.config;

import com.jean325.threadkeeper.provider.application.ImportSchedulerProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ImportSchedulerProperties.class)
public class ImportSchedulerConfig {
}
```

- [ ] **Step 5: Add config block to application.yml**

In `threadkeeper-api/src/main/resources/application.yml`, append under the existing top-level `threadkeeper:` key (sibling to `notifications:` and `portfolio:`), indented two spaces:
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
Read the file first to place the block correctly under the same `threadkeeper:` parent.

- [ ] **Step 6: Run the defaults test to verify it passes**

Run: `cd /Users/jean325/portfolio/projects/threadkeeper/threadkeeper-api && ./gradlew test --tests "*ImportSchedulerPropertiesTest"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/jean325/portfolio/projects/threadkeeper
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/application/ImportSchedulerProperties.java \
        threadkeeper-api/src/main/java/com/jean325/threadkeeper/global/config/ImportSchedulerConfig.java \
        threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/application/ImportSchedulerPropertiesTest.java \
        threadkeeper-api/src/main/resources/application.yml
git commit -m "feat(import): add automatic import scheduler config properties"
```

---

## Task 2: AutomaticImportScheduler

**Files:**
- Create: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/application/AutomaticImportScheduler.java`
- Test: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/application/AutomaticImportSchedulerTest.java`

- [ ] **Step 1: Write the failing test**

`threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/application/AutomaticImportSchedulerTest.java`:
```java
package com.jean325.threadkeeper.provider.application;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.jean325.threadkeeper.provider.dto.ProviderConnectionResponse;
import com.jean325.threadkeeper.provider.dto.RunProviderImportRequest;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

class AutomaticImportSchedulerTest {

    private final Instant now = Instant.parse("2026-06-03T09:00:00Z");
    private final Clock clock = Clock.fixed(now, ZoneOffset.UTC);

    private ImportSchedulerProperties props(boolean enabled, String migratorPath) {
        ImportSchedulerProperties p = new ImportSchedulerProperties();
        p.setEnabled(enabled);
        p.setConnectionId(1L);
        p.setTarget("codex,claude");
        p.setMigratorPath(migratorPath);
        p.setBridgePath("/bridge");
        p.setProfile("full");
        p.setIncludeSensitive(false);
        p.setStalenessThresholdHours(20);
        return p;
    }

    private ProviderConnectionResponse connection(long id, String status, Instant lastImportAt) {
        return new ProviderConnectionResponse(id, "CODEX", "default", "/home", status, lastImportAt, null);
    }

    @Test
    void disabledDoesNotImport() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        var scheduler = new AutomaticImportScheduler(service, props(false, "/migrator"), clock);

        scheduler.runDueImport();

        verify(service, never()).runImport(any(), any());
    }

    @Test
    void blankMigratorPathDoesNotImport() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        var scheduler = new AutomaticImportScheduler(service, props(true, "  "), clock);

        scheduler.runDueImport();

        verify(service, never()).runImport(any(), any());
    }

    @Test
    void missingConnectionDoesNotImport() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        when(service.listConnections()).thenReturn(List.of(connection(2L, "ACTIVE", null)));
        var scheduler = new AutomaticImportScheduler(service, props(true, "/migrator"), clock);

        scheduler.runDueImport();

        verify(service, never()).runImport(any(), any());
    }

    @Test
    void nonActiveConnectionDoesNotImport() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        when(service.listConnections()).thenReturn(List.of(connection(1L, "ERROR", null)));
        var scheduler = new AutomaticImportScheduler(service, props(true, "/migrator"), clock);

        scheduler.runDueImport();

        verify(service, never()).runImport(any(), any());
    }

    @Test
    void nullLastImportTriggersImportWithConfiguredArgs() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        when(service.listConnections()).thenReturn(List.of(connection(1L, "ACTIVE", null)));
        var scheduler = new AutomaticImportScheduler(service, props(true, "/migrator"), clock);

        scheduler.runDueImport();

        ArgumentCaptor<RunProviderImportRequest> captor = ArgumentCaptor.forClass(RunProviderImportRequest.class);
        verify(service, times(1)).runImport(eq(1L), captor.capture());
        RunProviderImportRequest req = captor.getValue();
        org.assertj.core.api.Assertions.assertThat(req.migratorPath()).isEqualTo("/migrator");
        org.assertj.core.api.Assertions.assertThat(req.bridgePath()).isEqualTo("/bridge");
        org.assertj.core.api.Assertions.assertThat(req.profile()).isEqualTo("full");
        org.assertj.core.api.Assertions.assertThat(req.target()).isEqualTo("codex,claude");
        org.assertj.core.api.Assertions.assertThat(req.includeSensitive()).isFalse();
    }

    @Test
    void recentImportIsSkipped() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        // 5h ago, threshold 20h -> not stale
        Instant recent = now.minus(5, ChronoUnit.HOURS);
        when(service.listConnections()).thenReturn(List.of(connection(1L, "ACTIVE", recent)));
        var scheduler = new AutomaticImportScheduler(service, props(true, "/migrator"), clock);

        scheduler.runDueImport();

        verify(service, never()).runImport(any(), any());
    }

    @Test
    void staleImportTriggers() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        // 21h ago, threshold 20h -> stale
        Instant stale = now.minus(21, ChronoUnit.HOURS);
        when(service.listConnections()).thenReturn(List.of(connection(1L, "ACTIVE", stale)));
        var scheduler = new AutomaticImportScheduler(service, props(true, "/migrator"), clock);

        scheduler.runDueImport();

        verify(service, times(1)).runImport(eq(1L), any());
    }

    @Test
    void doesNotRetryWithinThresholdAfterAnAttempt() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        Instant stale = now.minus(21, ChronoUnit.HOURS);
        when(service.listConnections()).thenReturn(List.of(connection(1L, "ACTIVE", stale)));
        var scheduler = new AutomaticImportScheduler(service, props(true, "/migrator"), clock);

        scheduler.runDueImport();
        scheduler.runDueImport(); // same fixed clock -> lastAttempt blocks the second run

        verify(service, times(1)).runImport(eq(1L), any());
    }

    @Test
    void runImportFailureDoesNotPropagate() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        when(service.listConnections()).thenReturn(List.of(connection(1L, "ACTIVE", null)));
        when(service.runImport(eq(1L), any())).thenThrow(new RuntimeException("bridge boom"));
        var scheduler = new AutomaticImportScheduler(service, props(true, "/migrator"), clock);

        assertThatCode(scheduler::runDueImport).doesNotThrowAnyException();
        verify(service, times(1)).runImport(eq(1L), any());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jean325/portfolio/projects/threadkeeper/threadkeeper-api && ./gradlew test --tests "*AutomaticImportSchedulerTest"`
Expected: FAIL — `AutomaticImportScheduler` does not exist (compile error).

- [ ] **Step 3: Write the scheduler implementation**

`threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/application/AutomaticImportScheduler.java`:
```java
package com.jean325.threadkeeper.provider.application;

import com.jean325.threadkeeper.provider.dto.ProviderConnectionResponse;
import com.jean325.threadkeeper.provider.dto.RunProviderImportRequest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AutomaticImportScheduler {

    private static final Logger log = LoggerFactory.getLogger(AutomaticImportScheduler.class);

    private final ProviderConnectionService providerConnectionService;
    private final ImportSchedulerProperties properties;
    private final Clock clock;

    private Instant lastAttempt;

    public AutomaticImportScheduler(
            ProviderConnectionService providerConnectionService,
            ImportSchedulerProperties properties,
            Clock clock
    ) {
        this.providerConnectionService = providerConnectionService;
        this.properties = properties;
        this.clock = clock;
    }

    @Scheduled(
            initialDelayString = "${threadkeeper.import-scheduler.check-delay-ms:3600000}",
            fixedDelayString = "${threadkeeper.import-scheduler.check-delay-ms:3600000}"
    )
    public void runDueImport() {
        if (!properties.isEnabled()) {
            return;
        }
        if (properties.getMigratorPath() == null || properties.getMigratorPath().isBlank()) {
            log.warn("Automatic import enabled but migrator-path is blank; skipping.");
            return;
        }

        ProviderConnectionResponse connection = findActiveConnection(properties.getConnectionId());
        if (connection == null) {
            log.warn(
                    "Automatic import: connection id={} not found or not ACTIVE; skipping.",
                    properties.getConnectionId()
            );
            return;
        }

        if (!shouldRun(connection)) {
            return;
        }

        lastAttempt = clock.instant();
        try {
            providerConnectionService.runImport(
                    connection.id(),
                    new RunProviderImportRequest(
                            properties.getMigratorPath(),
                            properties.getBridgePath(),
                            properties.getProfile(),
                            properties.getTarget(),
                            properties.isIncludeSensitive()
                    )
            );
            log.info("Automatic import completed for connection id={}.", connection.id());
        } catch (Exception e) {
            log.warn("Automatic import failed for connection id={}: {}", connection.id(), e.getMessage());
        }
    }

    private ProviderConnectionResponse findActiveConnection(long connectionId) {
        return providerConnectionService.listConnections().stream()
                .filter(c -> c.id() != null && c.id() == connectionId)
                .filter(c -> "ACTIVE".equals(c.status()))
                .findFirst()
                .orElse(null);
    }

    private boolean shouldRun(ProviderConnectionResponse connection) {
        Instant cutoff = clock.instant().minus(Duration.ofHours(properties.getStalenessThresholdHours()));
        boolean importStale = connection.lastImportAt() == null || connection.lastImportAt().isBefore(cutoff);
        boolean attemptStale = lastAttempt == null || lastAttempt.isBefore(cutoff);
        return importStale && attemptStale;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jean325/portfolio/projects/threadkeeper/threadkeeper-api && ./gradlew test --tests "*AutomaticImportSchedulerTest"`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/jean325/portfolio/projects/threadkeeper
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/provider/application/AutomaticImportScheduler.java \
        threadkeeper-api/src/test/java/com/jean325/threadkeeper/provider/application/AutomaticImportSchedulerTest.java
git commit -m "feat(import): add staleness catch-up automatic import scheduler"
```

---

## Task 3: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full api test suite**

Run: `cd /Users/jean325/portfolio/projects/threadkeeper/threadkeeper-api && ./gradlew test`
Expected: `BUILD SUCCESSFUL`, no regressions.

- [ ] **Step 2: Confirm the app context still loads (catches @Scheduled/bean wiring issues)**

Run: `cd /Users/jean325/portfolio/projects/threadkeeper/threadkeeper-api && ./gradlew compileJava`
Expected: `BUILD SUCCESSFUL`. (The full suite in Step 1 already boots the Spring context via existing `@SpringBootTest` tests, which will fail if the new `@Scheduled` bean or `ImportSchedulerProperties` wiring is broken.)

- [ ] **Step 3: Document how to enable it (manual, no code change)**

The feature is disabled by default. To enable on this machine, set these env vars before the API starts (the auto-start `scripts/start.sh` sources `.env`, so they can be added there):
```bash
THREADKEEPER_IMPORT_ENABLED=true
THREADKEEPER_IMPORT_MIGRATOR_PATH=/Users/jean325/IdeaProjects/company/tixpass/agent-state-migrator
THREADKEEPER_IMPORT_BRIDGE_PATH=/Users/jean325/portfolio/projects/threadkeeper/agent-state-migrator-bridge
# optional overrides:
# THREADKEEPER_IMPORT_CONNECTION_ID=1
# THREADKEEPER_IMPORT_TARGET=codex,claude
# THREADKEEPER_IMPORT_CHECK_DELAY_MS=3600000
# THREADKEEPER_IMPORT_STALENESS_HOURS=20
```
This step is documentation only — no commit required unless `.env`/runbook is updated (out of scope for the code change).

---

## Notes / Known Deviations from Spec

- **Single in-memory `lastAttempt` field** (not a map): the spec scopes auto-import to exactly one configured connection, so a single field is sufficient and clearer than a map. If multi-connection support is ever added (explicitly a non-goal), this becomes a `Map<Long, Instant>`.
- **Reuses the existing `Clock` bean** from `PortfolioConfig` (added in the readiness-badge feature). No second `Clock` bean is introduced.
- **No live import is triggered by tests.** The scheduler is unit-tested with a mocked `ProviderConnectionService`; the real bridge import is never invoked during the build. Enabling + a live run is a manual, machine-specific step (Task 3 Step 3).
