package com.jean325.threadkeeper.provider.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
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

    @Test
    void reportsZeroCountsBeforeAnyImport() throws Exception {
        createConnection();

        mockMvc.perform(get("/api/v1/provider-connections/1/imports/latest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connectionId").value(1))
                .andExpect(jsonPath("$.provider").value("CODEX"))
                .andExpect(jsonPath("$.importedSessionCount").value(0))
                .andExpect(jsonPath("$.linkedThreadCount").value(0))
                .andExpect(jsonPath("$.latestSessionImportedAt").doesNotExist())
                .andExpect(jsonPath("$.recentSessions").isEmpty());
    }

    @Test
    void countsImportedSessionsAndLinkedThreads() throws Exception {
        createConnection();
        importTwoSessions();

        mockMvc.perform(get("/api/v1/provider-connections/1/imports/latest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.lastImportAt").exists())
                .andExpect(jsonPath("$.importedSessionCount").value(2))
                .andExpect(jsonPath("$.linkedThreadCount").value(2))
                .andExpect(jsonPath("$.latestSessionImportedAt").exists())
                .andExpect(jsonPath("$.recentSessions.length()").value(2));
    }

    @Test
    void returnsNotFoundForUnknownConnection() throws Exception {
        mockMvc.perform(get("/api/v1/provider-connections/999/imports/latest"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PROVIDER_CONNECTION_NOT_FOUND"));
    }

    private void createConnection() throws Exception {
        mockMvc.perform(post("/api/v1/provider-connections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "CODEX",
                                  "accountLabel": "default",
                                  "homePath": "/Users/jean325"
                                }
                                """))
                .andExpect(status().isCreated());
    }

    private void importTwoSessions() throws Exception {
        mockMvc.perform(post("/api/v1/provider-connections/1/imports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "profile": "full",
                                  "includeSensitive": false,
                                  "sourceSessions": [
                                    {
                                      "provider": "CODEX",
                                      "providerSessionKey": "session-1",
                                      "sourceType": "session",
                                      "sourcePath": "/Users/jean325/.codex/sessions/session-1.jsonl",
                                      "title": "First session",
                                      "metadataJson": "{}"
                                    },
                                    {
                                      "provider": "CODEX",
                                      "providerSessionKey": "session-2",
                                      "sourceType": "session",
                                      "sourcePath": "/Users/jean325/.codex/sessions/session-2.jsonl",
                                      "title": "Second session",
                                      "metadataJson": "{}"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isCreated());
    }
}
