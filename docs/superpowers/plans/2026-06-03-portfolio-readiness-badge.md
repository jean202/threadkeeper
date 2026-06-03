# Portfolio Readiness Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display portfolio-tracker's readiness score as a read-only badge next to ThreadKeeper threads, by reading PT's exported scan JSON in TK-api and exposing it via a separate read-only resource.

**Architecture:** New `portfolio` feature package in TK-api reads PT's `scan-result.json` (path from config), parses it (mtime-cached, fails to empty), maps each project `name`→normalized `projectKey` with stale/age computed, and serves `GET /api/v1/portfolio-readiness`. TK-web fetches that map in parallel with threads and renders a badge by `projectKey`. TK never computes readiness — display only. Mirrors the asymmetric TK→PT pattern (consumer owns read + cache + graceful degrade in one component; `enabled` defaults false).

**Tech Stack:** Kotlin/Spring Boot project (Java 17 sources), Jackson, JUnit 5 + Spring Boot Test + H2 (api). Next.js 16 + React 19 + TypeScript + axios (web; no test runner — verified via `tsc --noEmit`, `next build`, manual).

**Spec:** `docs/superpowers/specs/2026-06-03-portfolio-readiness-badge-display-design.md`

---

## File Structure

**TK-api (new package `com.jean325.threadkeeper.portfolio`):**
- `portfolio/domain/PortfolioProperties.java` — `@ConfigurationProperties("threadkeeper.portfolio")`: `enabled`, `jsonPath`, `staleMaxDays`.
- `portfolio/application/PortfolioScanEntry.java` — record of raw fields read from PT JSON.
- `portfolio/application/PortfolioScanFileReader.java` — reads + parses PT JSON (mtime cache, fails to empty list).
- `portfolio/application/PortfolioReadinessService.java` — maps entries → responses (normalize key, compute stale/age, `enabled=false`→empty).
- `portfolio/dto/PortfolioReadinessResponse.java` — record returned by the API.
- `portfolio/api/PortfolioReadinessController.java` — `GET /api/v1/portfolio-readiness`.
- `global/config/PortfolioConfig.java` (new) — `@EnableConfigurationProperties` + `Clock` bean.
- `src/main/resources/application.yml` (modify) — add `threadkeeper.portfolio` block.
- Tests: reader test (plain JUnit + `@TempDir`), service test (plain JUnit + fixed `Clock`), controller test (`@SpringBootTest` + `@DynamicPropertySource`).

**TK-web:**
- `src/types/portfolio.ts` (new) — `PortfolioReadiness` interface.
- `src/api/client.ts` (modify) — `getPortfolioReadiness()` returning a `Map`, catches to empty.
- `src/components/PortfolioReadinessBadge.tsx` (new) — pure presentational badge.
- `src/pages/index.tsx` (modify) — list view, badge per row.
- `src/pages/threads/[threadId].tsx` (modify) — detail view, badge in overview.

---

## Task 1: Config scaffolding (properties, config, application.yml)

**Files:**
- Create: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/domain/PortfolioProperties.java`
- Create: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/global/config/PortfolioConfig.java`
- Modify: `threadkeeper-api/src/main/resources/application.yml`

- [ ] **Step 1: Create PortfolioProperties**

`threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/domain/PortfolioProperties.java`:
```java
package com.jean325.threadkeeper.portfolio.domain;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "threadkeeper.portfolio")
public class PortfolioProperties {

    private boolean enabled = false;
    private String jsonPath = "";
    private long staleMaxDays = 14;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getJsonPath() {
        return jsonPath;
    }

    public void setJsonPath(String jsonPath) {
        this.jsonPath = jsonPath;
    }

    public long getStaleMaxDays() {
        return staleMaxDays;
    }

    public void setStaleMaxDays(long staleMaxDays) {
        this.staleMaxDays = staleMaxDays;
    }
}
```

- [ ] **Step 2: Create PortfolioConfig (enable properties + Clock bean)**

`threadkeeper-api/src/main/java/com/jean325/threadkeeper/global/config/PortfolioConfig.java`:
```java
package com.jean325.threadkeeper.global.config;

import com.jean325.threadkeeper.portfolio.domain.PortfolioProperties;
import java.time.Clock;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(PortfolioProperties.class)
public class PortfolioConfig {

    @Bean
    public Clock portfolioClock() {
        return Clock.systemUTC();
    }
}
```

- [ ] **Step 3: Add config block to application.yml**

In `threadkeeper-api/src/main/resources/application.yml`, append under the existing top-level `threadkeeper:` key (sibling to `notifications:`):
```yaml
  portfolio:
    enabled: ${THREADKEEPER_PORTFOLIO_ENABLED:false}
    json-path: ${THREADKEEPER_PORTFOLIO_JSON_PATH:}
    stale-max-days: 14
```

- [ ] **Step 4: Verify it compiles**

Run: `cd threadkeeper-api && ./gradlew compileJava`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit**

```bash
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/domain/PortfolioProperties.java \
        threadkeeper-api/src/main/java/com/jean325/threadkeeper/global/config/PortfolioConfig.java \
        threadkeeper-api/src/main/resources/application.yml
git commit -m "feat(portfolio): add portfolio readiness config properties and wiring"
```

---

## Task 2: PortfolioScanFileReader (read + parse PT JSON, mtime-cached)

**Files:**
- Create: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/application/PortfolioScanEntry.java`
- Create: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/application/PortfolioScanFileReader.java`
- Test: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/portfolio/application/PortfolioScanFileReaderTest.java`

- [ ] **Step 1: Create the PortfolioScanEntry record (raw fields)**

`threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/application/PortfolioScanEntry.java`:
```java
package com.jean325.threadkeeper.portfolio.application;

public record PortfolioScanEntry(String name, int readiness, int baseReadiness, String scannedAt) {
}
```

- [ ] **Step 2: Write the failing test**

`threadkeeper-api/src/test/java/com/jean325/threadkeeper/portfolio/application/PortfolioScanFileReaderTest.java`:
```java
package com.jean325.threadkeeper.portfolio.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.jean325.threadkeeper.portfolio.domain.PortfolioProperties;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PortfolioScanFileReaderTest {

    @TempDir
    Path tempDir;

    private PortfolioScanFileReader readerFor(Path jsonPath) {
        PortfolioProperties props = new PortfolioProperties();
        props.setJsonPath(jsonPath.toString());
        return new PortfolioScanFileReader(props);
    }

    @Test
    void parsesProjectsFromValidFile() throws Exception {
        Path file = tempDir.resolve("scan.json");
        Files.writeString(file, """
                {"projects":[
                  {"name":"threadkeeper","readiness":82,"baseReadiness":71,"scannedAt":"2026-06-02T22:47:50.883Z"}
                ]}
                """);
        List<PortfolioScanEntry> entries = readerFor(file).read();
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).name()).isEqualTo("threadkeeper");
        assertThat(entries.get(0).readiness()).isEqualTo(82);
        assertThat(entries.get(0).baseReadiness()).isEqualTo(71);
        assertThat(entries.get(0).scannedAt()).isEqualTo("2026-06-02T22:47:50.883Z");
    }

    @Test
    void returnsEmptyWhenFileMissing() {
        assertThat(readerFor(tempDir.resolve("nope.json")).read()).isEmpty();
    }

    @Test
    void returnsEmptyWhenJsonMalformed() throws Exception {
        Path file = tempDir.resolve("broken.json");
        Files.writeString(file, "{not json");
        assertThat(readerFor(file).read()).isEmpty();
    }

    @Test
    void returnsEmptyWhenPathBlank() {
        PortfolioProperties props = new PortfolioProperties();
        props.setJsonPath("");
        assertThat(new PortfolioScanFileReader(props).read()).isEmpty();
    }

    @Test
    void rereadsOnlyWhenMtimeChanges() throws Exception {
        Path file = tempDir.resolve("scan.json");
        Files.writeString(file, """
                {"projects":[{"name":"a","readiness":10,"baseReadiness":10,"scannedAt":"2026-06-02T00:00:00Z"}]}
                """);
        Files.setLastModifiedTime(file, FileTime.fromMillis(1_000_000L));
        PortfolioScanFileReader reader = readerFor(file);
        assertThat(reader.read().get(0).readiness()).isEqualTo(10);

        // Change content but KEEP same mtime → cached value returned.
        Files.writeString(file, """
                {"projects":[{"name":"a","readiness":99,"baseReadiness":99,"scannedAt":"2026-06-02T00:00:00Z"}]}
                """);
        Files.setLastModifiedTime(file, FileTime.fromMillis(1_000_000L));
        assertThat(reader.read().get(0).readiness()).isEqualTo(10);

        // Bump mtime → re-read.
        Files.setLastModifiedTime(file, FileTime.fromMillis(2_000_000L));
        assertThat(reader.read().get(0).readiness()).isEqualTo(99);
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd threadkeeper-api && ./gradlew test --tests "*PortfolioScanFileReaderTest"`
Expected: FAIL — compilation error, `PortfolioScanFileReader` does not exist.

- [ ] **Step 4: Write the reader implementation**

`threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/application/PortfolioScanFileReader.java`:
```java
package com.jean325.threadkeeper.portfolio.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jean325.threadkeeper.portfolio.domain.PortfolioProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class PortfolioScanFileReader {

    private final PortfolioProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private long cachedMtime = Long.MIN_VALUE;
    private List<PortfolioScanEntry> cached = List.of();

    public PortfolioScanFileReader(PortfolioProperties properties) {
        this.properties = properties;
    }

    public synchronized List<PortfolioScanEntry> read() {
        String pathValue = properties.getJsonPath();
        if (pathValue == null || pathValue.isBlank()) {
            return List.of();
        }
        Path path = Path.of(pathValue);
        if (!Files.isRegularFile(path)) {
            cachedMtime = Long.MIN_VALUE;
            cached = List.of();
            return cached;
        }
        try {
            long mtime = Files.getLastModifiedTime(path).toMillis();
            if (mtime == cachedMtime) {
                return cached;
            }
            cached = parse(path);
            cachedMtime = mtime;
            return cached;
        } catch (IOException e) {
            cachedMtime = Long.MIN_VALUE;
            cached = List.of();
            return cached;
        }
    }

    private List<PortfolioScanEntry> parse(Path path) {
        try {
            JsonNode root = objectMapper.readTree(Files.readAllBytes(path));
            JsonNode projects = root.path("projects");
            if (!projects.isArray()) {
                return List.of();
            }
            List<PortfolioScanEntry> entries = new ArrayList<>();
            for (JsonNode project : projects) {
                String name = project.path("name").asText(null);
                if (name == null || name.isBlank()) {
                    continue;
                }
                int readiness = project.path("readiness").asInt(0);
                int baseReadiness = project.path("baseReadiness").asInt(readiness);
                String scannedAt = project.path("scannedAt").asText(null);
                entries.add(new PortfolioScanEntry(name, readiness, baseReadiness, scannedAt));
            }
            return List.copyOf(entries);
        } catch (IOException e) {
            return List.of();
        }
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd threadkeeper-api && ./gradlew test --tests "*PortfolioScanFileReaderTest"`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/application/PortfolioScanEntry.java \
        threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/application/PortfolioScanFileReader.java \
        threadkeeper-api/src/test/java/com/jean325/threadkeeper/portfolio/application/PortfolioScanFileReaderTest.java
git commit -m "feat(portfolio): read and parse PT scan JSON with mtime cache"
```

---

## Task 3: PortfolioReadinessService (map entries → responses)

**Files:**
- Create: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/dto/PortfolioReadinessResponse.java`
- Create: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/application/PortfolioReadinessService.java`
- Test: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/portfolio/application/PortfolioReadinessServiceTest.java`

- [ ] **Step 1: Create the response record**

`threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/dto/PortfolioReadinessResponse.java`:
```java
package com.jean325.threadkeeper.portfolio.dto;

import java.time.Instant;

public record PortfolioReadinessResponse(
        String projectKey,
        int readiness,
        int baseReadiness,
        Instant scannedAt,
        boolean stale,
        long ageDays
) {
}
```

- [ ] **Step 2: Write the failing test**

`threadkeeper-api/src/test/java/com/jean325/threadkeeper/portfolio/application/PortfolioReadinessServiceTest.java`:
```java
package com.jean325.threadkeeper.portfolio.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.jean325.threadkeeper.portfolio.domain.PortfolioProperties;
import com.jean325.threadkeeper.portfolio.dto.PortfolioReadinessResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class PortfolioReadinessServiceTest {

    private final Instant now = Instant.parse("2026-06-03T00:00:00Z");
    private final Clock clock = Clock.fixed(now, ZoneOffset.UTC);

    private PortfolioReadinessService serviceWith(
            boolean enabled, long staleMaxDays, List<PortfolioScanEntry> entries) {
        PortfolioProperties props = new PortfolioProperties();
        props.setEnabled(enabled);
        props.setStaleMaxDays(staleMaxDays);
        PortfolioScanFileReader reader = new PortfolioScanFileReader(props) {
            @Override
            public synchronized List<PortfolioScanEntry> read() {
                return entries;
            }
        };
        return new PortfolioReadinessService(props, reader, clock);
    }

    @Test
    void returnsEmptyWhenDisabled() {
        var service = serviceWith(false, 14, List.of(
                new PortfolioScanEntry("threadkeeper", 80, 70, "2026-06-03T00:00:00Z")));
        assertThat(service.listReadiness()).isEmpty();
    }

    @Test
    void normalizesNameToProjectKey() {
        var service = serviceWith(true, 14, List.of(
                new PortfolioScanEntry("  ThreadKeeper ", 82, 71, "2026-06-02T00:00:00Z")));
        List<PortfolioReadinessResponse> result = service.listReadiness();
        assertThat(result).hasSize(1);
        assertThat(result.get(0).projectKey()).isEqualTo("threadkeeper");
        assertThat(result.get(0).readiness()).isEqualTo(82);
        assertThat(result.get(0).baseReadiness()).isEqualTo(71);
    }

    @Test
    void marksStaleWhenOlderThanStaleMaxDays() {
        var service = serviceWith(true, 14, List.of(
                new PortfolioScanEntry("a", 50, 50, "2026-05-14T00:00:00Z")));
        var r = service.listReadiness().get(0);
        assertThat(r.ageDays()).isEqualTo(20);
        assertThat(r.stale()).isTrue();
    }

    @Test
    void notStaleWhenWithinStaleMaxDays() {
        var service = serviceWith(true, 14, List.of(
                new PortfolioScanEntry("a", 50, 50, "2026-05-30T00:00:00Z")));
        var r = service.listReadiness().get(0);
        assertThat(r.ageDays()).isEqualTo(4);
        assertThat(r.stale()).isFalse();
    }

    @Test
    void handlesUnparseableScannedAt() {
        var service = serviceWith(true, 14, List.of(
                new PortfolioScanEntry("a", 50, 50, "not-a-date")));
        var r = service.listReadiness().get(0);
        assertThat(r.scannedAt()).isNull();
        assertThat(r.ageDays()).isEqualTo(-1);
        assertThat(r.stale()).isFalse();
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd threadkeeper-api && ./gradlew test --tests "*PortfolioReadinessServiceTest"`
Expected: FAIL — `PortfolioReadinessService` does not exist.

- [ ] **Step 4: Write the service implementation**

`threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/application/PortfolioReadinessService.java`:
```java
package com.jean325.threadkeeper.portfolio.application;

import com.jean325.threadkeeper.portfolio.domain.PortfolioProperties;
import com.jean325.threadkeeper.portfolio.dto.PortfolioReadinessResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;

@Service
public class PortfolioReadinessService {

    private final PortfolioProperties properties;
    private final PortfolioScanFileReader reader;
    private final Clock clock;

    public PortfolioReadinessService(
            PortfolioProperties properties,
            PortfolioScanFileReader reader,
            Clock clock
    ) {
        this.properties = properties;
        this.reader = reader;
        this.clock = clock;
    }

    public List<PortfolioReadinessResponse> listReadiness() {
        if (!properties.isEnabled()) {
            return List.of();
        }
        Instant now = clock.instant();
        List<PortfolioReadinessResponse> result = new ArrayList<>();
        for (PortfolioScanEntry entry : reader.read()) {
            String projectKey = entry.name().trim().toLowerCase(Locale.ROOT);
            Instant scannedAt = parseInstant(entry.scannedAt());
            long ageDays = scannedAt == null ? -1 : Duration.between(scannedAt, now).toDays();
            boolean stale = ageDays >= 0 && ageDays > properties.getStaleMaxDays();
            result.add(new PortfolioReadinessResponse(
                    projectKey,
                    entry.readiness(),
                    entry.baseReadiness(),
                    scannedAt,
                    stale,
                    ageDays
            ));
        }
        return List.copyOf(result);
    }

    private Instant parseInstant(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd threadkeeper-api && ./gradlew test --tests "*PortfolioReadinessServiceTest"`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/dto/PortfolioReadinessResponse.java \
        threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/application/PortfolioReadinessService.java \
        threadkeeper-api/src/test/java/com/jean325/threadkeeper/portfolio/application/PortfolioReadinessServiceTest.java
git commit -m "feat(portfolio): map scan entries to readiness responses with stale/age"
```

---

## Task 4: PortfolioReadinessController (REST endpoint)

**Files:**
- Create: `threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/api/PortfolioReadinessController.java`
- Test: `threadkeeper-api/src/test/java/com/jean325/threadkeeper/portfolio/api/PortfolioReadinessControllerTest.java`

- [ ] **Step 1: Write the failing test**

`threadkeeper-api/src/test/java/com/jean325/threadkeeper/portfolio/api/PortfolioReadinessControllerTest.java`:
```java
package com.jean325.threadkeeper.portfolio.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PortfolioReadinessControllerTest {

    @TempDir
    static Path tempDir;

    static Path scanFile;

    @BeforeAll
    static void writeScanFile() throws Exception {
        scanFile = tempDir.resolve("scan.json");
        Files.writeString(scanFile, """
                {"projects":[
                  {"name":"threadkeeper","readiness":82,"baseReadiness":71,"scannedAt":"2026-06-02T22:47:50.883Z"}
                ]}
                """);
    }

    @DynamicPropertySource
    static void portfolioProps(DynamicPropertyRegistry registry) {
        registry.add("threadkeeper.portfolio.enabled", () -> "true");
        registry.add("threadkeeper.portfolio.json-path", () -> scanFile.toString());
        registry.add("threadkeeper.portfolio.stale-max-days", () -> "14");
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void returnsReadinessForProjects() throws Exception {
        mockMvc.perform(get("/api/v1/portfolio-readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].projectKey").value("threadkeeper"))
                .andExpect(jsonPath("$[0].readiness").value(82))
                .andExpect(jsonPath("$[0].baseReadiness").value(71));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd threadkeeper-api && ./gradlew test --tests "*PortfolioReadinessControllerTest"`
Expected: FAIL — no handler for `/api/v1/portfolio-readiness` (404), or compilation error if controller absent.

- [ ] **Step 3: Write the controller**

`threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/api/PortfolioReadinessController.java`:
```java
package com.jean325.threadkeeper.portfolio.api;

import com.jean325.threadkeeper.portfolio.application.PortfolioReadinessService;
import com.jean325.threadkeeper.portfolio.dto.PortfolioReadinessResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/portfolio-readiness")
public class PortfolioReadinessController {

    private final PortfolioReadinessService service;

    public PortfolioReadinessController(PortfolioReadinessService service) {
        this.service = service;
    }

    @GetMapping
    public List<PortfolioReadinessResponse> listReadiness() {
        return service.listReadiness();
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd threadkeeper-api && ./gradlew test --tests "*PortfolioReadinessControllerTest"`
Expected: PASS.

- [ ] **Step 5: Run the full api test suite to confirm no regressions**

Run: `cd threadkeeper-api && ./gradlew test`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Commit**

```bash
git add threadkeeper-api/src/main/java/com/jean325/threadkeeper/portfolio/api/PortfolioReadinessController.java \
        threadkeeper-api/src/test/java/com/jean325/threadkeeper/portfolio/api/PortfolioReadinessControllerTest.java
git commit -m "feat(portfolio): expose GET /api/v1/portfolio-readiness"
```

---

## Task 5: Web types + API client method

**Files:**
- Create: `threadkeeper-web/src/types/portfolio.ts`
- Modify: `threadkeeper-web/src/api/client.ts`

- [ ] **Step 1: Create the PortfolioReadiness type**

`threadkeeper-web/src/types/portfolio.ts`:
```ts
export interface PortfolioReadiness {
  projectKey: string;
  readiness: number;
  baseReadiness: number;
  scannedAt: string | null;
  stale: boolean;
  ageDays: number;
}
```

- [ ] **Step 2: Add the client method**

In `threadkeeper-web/src/api/client.ts`, add this import near the top (next to the existing thread import):
```ts
import { PortfolioReadiness } from '@/types/portfolio';
```

Add this method to the `ThreadKeeperClient` class, after `updateNextAction`:
```ts
  async getPortfolioReadiness(): Promise<Map<string, PortfolioReadiness>> {
    try {
      const response = await this.client.get<PortfolioReadiness[]>('/portfolio-readiness');
      return new Map(response.data.map((item) => [item.projectKey, item]));
    } catch {
      // Graceful degradation: PT data is optional display context, never a hard failure.
      return new Map();
    }
  }
```

- [ ] **Step 3: Verify it typechecks**

Run: `cd threadkeeper-web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add threadkeeper-web/src/types/portfolio.ts threadkeeper-web/src/api/client.ts
git commit -m "feat(web): add portfolio readiness client and type"
```

---

## Task 6: Web badge component

**Files:**
- Create: `threadkeeper-web/src/components/PortfolioReadinessBadge.tsx`

- [ ] **Step 1: Create the badge component**

`threadkeeper-web/src/components/PortfolioReadinessBadge.tsx`:
```tsx
import { PortfolioReadiness } from '@/types/portfolio';

interface Props {
  readiness?: PortfolioReadiness;
}

function formatAge(ageDays: number): string {
  if (ageDays < 0) return '';
  if (ageDays === 0) return '오늘';
  return `${ageDays}일 전`;
}

export default function PortfolioReadinessBadge({ readiness }: Props) {
  if (!readiness) return null;

  const age = formatAge(readiness.ageDays);
  const label = age ? `${readiness.readiness}% · ${age}` : `${readiness.readiness}%`;

  return (
    <span
      title="portfolio-tracker"
      style={{
        marginLeft: '8px',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '12px',
        border: '1px solid #ccc',
        opacity: readiness.stale ? 0.5 : 1,
      }}
    >
      포트폴리오 {label}
      {readiness.stale ? ' (stale)' : ''}
    </span>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd threadkeeper-web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add threadkeeper-web/src/components/PortfolioReadinessBadge.tsx
git commit -m "feat(web): add read-only portfolio readiness badge component"
```

---

## Task 7: Web list page integration

**Files:**
- Modify: `threadkeeper-web/src/pages/index.tsx`

- [ ] **Step 1: Replace the page with the integrated version**

Replace the entire contents of `threadkeeper-web/src/pages/index.tsx` with:
```tsx
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { threadKeeperClient } from '@/api/client';
import { ThreadResponse } from '@/types/thread';
import { PortfolioReadiness } from '@/types/portfolio';
import PortfolioReadinessBadge from '@/components/PortfolioReadinessBadge';

export default function Home() {
  const [threads, setThreads] = useState<ThreadResponse[]>([]);
  const [readiness, setReadiness] = useState<Map<string, PortfolioReadiness>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [threadData, readinessData] = await Promise.all([
          threadKeeperClient.listThreads(),
          threadKeeperClient.getPortfolioReadiness(),
        ]);
        setThreads(threadData);
        setReadiness(readinessData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load threads');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>ThreadKeeper</h1>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/today" style={{ marginRight: '10px' }}>
          Today
        </Link>
      </div>
      <h2>Threads</h2>
      {threads.length === 0 ? (
        <p>No threads found</p>
      ) : (
        <ul>
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link href={`/threads/${thread.id}`}>{thread.title}</Link>{' '}
              - {thread.status}
              <PortfolioReadinessBadge readiness={readiness.get(thread.projectKey)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd threadkeeper-web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add threadkeeper-web/src/pages/index.tsx
git commit -m "feat(web): show portfolio readiness badge in thread list"
```

---

## Task 8: Web detail page integration

**Files:**
- Modify: `threadkeeper-web/src/pages/threads/[threadId].tsx`

- [ ] **Step 1: Add imports**

In `threadkeeper-web/src/pages/threads/[threadId].tsx`, add after the existing imports:
```tsx
import { PortfolioReadiness } from '@/types/portfolio';
import PortfolioReadinessBadge from '@/components/PortfolioReadinessBadge';
```

- [ ] **Step 2: Add readiness state and fetch it alongside the thread**

Add this state declaration after the existing `error` state:
```tsx
  const [readiness, setReadiness] = useState<PortfolioReadiness | undefined>(undefined);
```

Replace the existing `loadThread` body inside the `useEffect` with:
```tsx
    const loadThread = async () => {
      try {
        const [data, readinessMap] = await Promise.all([
          threadKeeperClient.getThread(Number(threadId)),
          threadKeeperClient.getPortfolioReadiness(),
        ]);
        setThread(data);
        setReadiness(readinessMap.get(data.projectKey));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load thread');
      } finally {
        setLoading(false);
      }
    };
```

- [ ] **Step 3: Render the badge in the Overview section**

In the Overview `<section>`, add the badge as a new line after the `Drift Status` paragraph:
```tsx
        <p><strong>Portfolio:</strong> <PortfolioReadinessBadge readiness={readiness} /></p>
```

- [ ] **Step 4: Verify it typechecks**

Run: `cd threadkeeper-web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add threadkeeper-web/src/pages/threads/[threadId].tsx
git commit -m "feat(web): show portfolio readiness badge on thread detail"
```

---

## Task 9: Full verification + manual check

**Files:** none (verification only)

- [ ] **Step 1: Run the full api test suite**

Run: `cd threadkeeper-api && ./gradlew test`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 2: Typecheck and build the web app**

Run: `cd threadkeeper-web && npx tsc --noEmit && npm run build`
Expected: typecheck clean, `next build` succeeds.

- [ ] **Step 3: Manual smoke test (badge appears / degrades gracefully)**

1. With `THREADKEEPER_PORTFOLIO_ENABLED=false` (default), start api + web; confirm thread list and detail render normally with **no badge** and no console errors.
2. Point `THREADKEEPER_PORTFOLIO_JSON_PATH` at a real PT `scan-result.json` whose a project `name` matches an existing `thread.projectKey`, set `THREADKEEPER_PORTFOLIO_ENABLED=true`, restart api. Confirm the badge shows `포트폴리오 NN% · N일 전` for that thread, and threads with no matching project show no badge.
3. (Optional) Temporarily stop the api while web is up; confirm threads still load via cached/empty readiness and no badge — web does not error.

- [ ] **Step 4: Final commit (if any manual-fix changes were needed)**

```bash
git add -A
git commit -m "chore(portfolio): verification pass for readiness badge"
```

---

## Notes / Known Deviations from Spec

- **Web tests:** the spec (§8) lists web unit tests, but `threadkeeper-web` has **no test runner** (no jest/vitest in `package.json`). Introducing one is out of scope for this shallow feature. Web is verified via `tsc --noEmit`, `next build`, and the manual smoke test in Task 9. If automated web tests become desired, add a runner in a separate change.
- **Clock bean:** a single `Clock` bean is introduced in `PortfolioConfig` for testable stale/age computation. No other code currently injects `Clock`, so there is no conflict.
- **No hyperlink (spec §7 가정 A):** the badge `title` attribute carries the source label `portfolio-tracker`; there is intentionally no link, because PT has no web surface today.
