package com.jean325.threadkeeper.provider.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProviderImportMergeTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void reusesExistingSourceSessionForSameProviderSessionKey() throws Exception {
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

        String importBody = """
                {
                  "profile": "full",
                  "includeSensitive": false,
                  "sourceSessions": [
                    {
                      "threadId": null,
                      "projectKey": "threadkeeper",
                      "provider": "CODEX",
                      "providerSessionKey": "session-merge",
                      "sourceType": "sessions",
                      "sourcePath": "/Users/jean325/.codex/sessions/session-merge.json",
                      "title": "Reusable import",
                      "metadataJson": "{}"
                    }
                  ]
                }
                """;

        MvcResult first = mockMvc.perform(post("/api/v1/provider-connections/1/imports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(importBody))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode firstJson = objectMapper.readTree(first.getResponse().getContentAsString());
        long firstSourceSessionId = firstJson.get(0).get("id").asLong();

        mockMvc.perform(post("/api/v1/provider-connections/1/imports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(importBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$[0].id").value(firstSourceSessionId));
    }

    @Test
    void attachesImportToExplicitThreadId() throws Exception {
        mockMvc.perform(post("/api/v1/provider-connections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "CLAUDE",
                                  "accountLabel": "default",
                                  "homePath": "/Users/jean325"
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectKey": "threadkeeper",
                                  "title": "Manual target thread",
                                  "priority": "HIGH",
                                  "originalIntent": "Keep one canonical thread.",
                                  "todayGoal": "Attach imports explicitly.",
                                  "doneCondition": "Import uses existing thread."
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/provider-connections/1/imports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "profile": "full",
                                  "includeSensitive": false,
                                  "sourceSessions": [
                                    {
                                      "threadId": 1,
                                      "projectKey": "threadkeeper",
                                      "provider": "CLAUDE",
                                      "providerSessionKey": "explicit-thread",
                                      "sourceType": "plans",
                                      "sourcePath": "/Users/jean325/.claude/plans/explicit-thread.md",
                                      "title": "Imported plan",
                                      "metadataJson": "{}"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$[0].threadId").value(1));
    }

    @Test
    void matchesActiveThreadByProjectKeyAndTitle() throws Exception {
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

        MvcResult createdThread = mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectKey": "signalmate",
                                  "title": "Shared merge title",
                                  "priority": "MEDIUM",
                                  "originalIntent": "Import into same project thread.",
                                  "todayGoal": "Use project-aware matching.",
                                  "doneCondition": "Existing active thread is reused."
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode createdThreadJson = objectMapper.readTree(createdThread.getResponse().getContentAsString());
        long expectedThreadId = createdThreadJson.get("id").asLong();

        mockMvc.perform(post("/api/v1/provider-connections/1/imports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "profile": "full",
                                  "includeSensitive": false,
                                  "sourceSessions": [
                                    {
                                      "threadId": null,
                                      "projectKey": "signalmate",
                                      "provider": "CODEX",
                                      "providerSessionKey": "project-aware-1",
                                      "sourceType": "sessions",
                                      "sourcePath": "/Users/jean325/.codex/sessions/project-aware-1.json",
                                      "title": "Shared merge title",
                                      "metadataJson": "{}"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$[0].threadId").value(expectedThreadId));
    }
}
