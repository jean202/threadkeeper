package com.jean325.threadkeeper.provider.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jean325.threadkeeper.provider.application.BridgeImportClient;
import com.jean325.threadkeeper.provider.dto.BridgeImportPayload;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class ProviderConnectionLatestImportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private BridgeImportClient bridgeImportClient;

    /** Ids are not assumed: each test asks the API which connection it just made. */
    private long connectionId;

    @BeforeEach
    void createConnection() throws Exception {
        String body = mockMvc.perform(post("/api/v1/provider-connections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "CODEX",
                                  "accountLabel": "default",
                                  "homePath": "/Users/jean325"
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        connectionId = objectMapper.readTree(body).get("id").asLong();
    }

    @Test
    void reportsZeroCountsBeforeAnyImport() throws Exception {
        getLatestImport()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connectionId").value(connectionId))
                .andExpect(jsonPath("$.provider").value("CODEX"))
                .andExpect(jsonPath("$.importedSessionCount").value(0))
                .andExpect(jsonPath("$.linkedThreadCount").value(0))
                .andExpect(jsonPath("$.lastImportAt").doesNotExist())
                .andExpect(jsonPath("$.latestSessionImportedAt").doesNotExist())
                .andExpect(jsonPath("$.recentSessions").isEmpty());
    }

    @Test
    void countsImportedSessions() throws Exception {
        importSessions("session-1", "session-2");

        getLatestImport()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.lastImportAt").exists())
                .andExpect(jsonPath("$.importedSessionCount").value(2))
                .andExpect(jsonPath("$.latestSessionImportedAt").exists())
                .andExpect(jsonPath("$.recentSessions.length()").value(2));
    }

    /**
     * Two sessions on one thread is one linked thread, not two. Counting rows
     * instead of distinct threads is the easy way to get this wrong.
     */
    @Test
    void linkedThreadCountCountsThreadsNotSessions() throws Exception {
        importSessions("session-1", "session-2");
        long threadId = firstRecentSessionThreadId();

        // A third session pinned to a thread that already has one.
        mockMvc.perform(post("/api/v1/provider-connections/" + connectionId + "/imports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "profile": "full",
                                  "includeSensitive": false,
                                  "sourceSessions": [
                                    {
                                      "threadId": %d,
                                      "provider": "CODEX",
                                      "providerSessionKey": "session-3",
                                      "sourceType": "session",
                                      "title": "Shares a thread",
                                      "metadataJson": "{}"
                                    }
                                  ]
                                }
                                """.formatted(threadId)))
                .andExpect(status().isCreated());

        getLatestImport()
                .andExpect(jsonPath("$.importedSessionCount").value(3))
                .andExpect(jsonPath("$.linkedThreadCount").value(2));
    }

    /**
     * The reason this endpoint carries both timestamps: a run that finds
     * nothing new still moves the connection's own lastImportAt, and only the
     * row-derived timestamp tells you when content last actually arrived.
     */
    @Test
    void aRunThatImportsNothingMovesOnlyTheConnectionTimestamp() throws Exception {
        importSessions("session-1");

        String beforeRun = getLatestImport().andReturn().getResponse().getContentAsString();
        String lastImportBefore = objectMapper.readTree(beforeRun).get("lastImportAt").asText();
        String sessionImportBefore =
                objectMapper.readTree(beforeRun).get("latestSessionImportedAt").asText();

        when(bridgeImportClient.runImport(any(), any())).thenReturn(
                new BridgeImportPayload("2026-04-29T00:00:00Z", List.of("CODEX"), List.of()));
        mockMvc.perform(post("/api/v1/provider-connections/" + connectionId + "/imports/run")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"migratorPath": "/tmp/agent-state-migrator", "includeSensitive": false}
                                """))
                .andExpect(status().isCreated());

        String afterRun = getLatestImport().andReturn().getResponse().getContentAsString();
        String lastImportAfter = objectMapper.readTree(afterRun).get("lastImportAt").asText();
        String sessionImportAfter =
                objectMapper.readTree(afterRun).get("latestSessionImportedAt").asText();

        org.assertj.core.api.Assertions.assertThat(lastImportAfter).isNotEqualTo(lastImportBefore);
        org.assertj.core.api.Assertions.assertThat(sessionImportAfter).isEqualTo(sessionImportBefore);
        getLatestImport().andExpect(jsonPath("$.importedSessionCount").value(1));
    }

    @Test
    void recentSessionsAreCappedAndNewestFirst() throws Exception {
        importSessions(IntStream.rangeClosed(1, 7).mapToObj(i -> "session-" + i).toArray(String[]::new));

        getLatestImport()
                .andExpect(jsonPath("$.importedSessionCount").value(7))
                .andExpect(jsonPath("$.recentSessions.length()").value(5));

        String body = getLatestImport().andReturn().getResponse().getContentAsString();
        var timestamps = objectMapper.readTree(body).get("recentSessions").findValuesAsText("importedAt");
        org.assertj.core.api.Assertions.assertThat(timestamps).isSortedAccordingTo((a, b) -> b.compareTo(a));
    }

    @Test
    void returnsNotFoundForUnknownConnection() throws Exception {
        mockMvc.perform(get("/api/v1/provider-connections/999999/imports/latest"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PROVIDER_CONNECTION_NOT_FOUND"));
    }

    private org.springframework.test.web.servlet.ResultActions getLatestImport() throws Exception {
        return mockMvc.perform(get("/api/v1/provider-connections/" + connectionId + "/imports/latest"));
    }

    private long firstRecentSessionThreadId() throws Exception {
        String body = getLatestImport().andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("recentSessions").get(0).get("threadId").asLong();
    }

    private void importSessions(String... sessionKeys) throws Exception {
        String items = java.util.Arrays.stream(sessionKeys)
                .map(key -> """
                        {
                          "provider": "CODEX",
                          "providerSessionKey": "%s",
                          "sourceType": "session",
                          "sourcePath": "/Users/jean325/.codex/sessions/%s.jsonl",
                          "title": "Session %s",
                          "metadataJson": "{}"
                        }
                        """.formatted(key, key, key))
                .collect(Collectors.joining(","));

        mockMvc.perform(post("/api/v1/provider-connections/" + connectionId + "/imports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "profile": "full",
                                  "includeSensitive": false,
                                  "sourceSessions": [%s]
                                }
                                """.formatted(items)))
                .andExpect(status().isCreated());
    }
}
