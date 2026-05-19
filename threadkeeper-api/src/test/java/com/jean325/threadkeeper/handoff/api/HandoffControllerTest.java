package com.jean325.threadkeeper.handoff.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
class HandoffControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void createsAndUpdatesHandoff() throws Exception {
        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectKey": "threadkeeper",
                                  "title": "Handoff thread",
                                  "priority": "HIGH",
                                  "originalIntent": "Prepare handoff.",
                                  "todayGoal": "Create handoff endpoint.",
                                  "doneCondition": "Handoff persists."
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/threads/1/handoffs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "targetProvider": "CLAUDE",
                                  "reason": "Architecture review",
                                  "whatChanged": "Core endpoints implemented.",
                                  "blockers": "Need review.",
                                  "nextAction": "Validate notification flow.",
                                  "filesNote": "threadkeeper-api",
                                  "status": "READY"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.targetProvider").value("CLAUDE"))
                .andExpect(jsonPath("$.status").value("READY"));

        mockMvc.perform(patch("/api/v1/handoffs/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "status": "USED"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("USED"));

        mockMvc.perform(get("/api/v1/threads/1/handoffs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].reason").value("Architecture review"));
    }

    @Test
    void generatesDraftFromLatestSnapshotAndSourceSession() throws Exception {
        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectKey": "threadkeeper",
                                  "title": "Draft handoff thread",
                                  "priority": "HIGH",
                                  "originalIntent": "Keep the original session plan intact across providers.",
                                  "todayGoal": "Prepare a reusable handoff draft.",
                                  "doneCondition": "Auto-generated draft is created."
                                }
                                """))
                .andExpect(status().isCreated());

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
                                      "provider": "CODEX",
                                      "providerSessionKey": "session-draft-1",
                                      "sourceType": "sessions",
                                      "sourcePath": "/Users/jean325/.codex/sessions/session-draft-1.json",
                                      "title": "Codex planning session",
                                      "metadataJson": "{\\"itemId\\":\\"codex:sessions:1\\"}"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$[0].id").value(1));

        mockMvc.perform(post("/api/v1/threads/1/snapshots")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "snapshotType": "PROGRESS",
                                  "summary": "Built import and notification paths, next is the handoff flow.",
                                  "nextAction": "Generate a handoff draft for Claude review.",
                                  "blockers": "Need a compact summary of what changed.",
                                  "driftScore": 12.50,
                                  "driftStatus": "ON_TRACK"
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/threads/1/handoffs/draft")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "targetProvider": "CLAUDE",
                                  "reasonHint": "Architecture review and next-step handoff"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.targetProvider").value("CLAUDE"))
                .andExpect(jsonPath("$.sourceSessionId").value(1))
                .andExpect(jsonPath("$.reason").value("Architecture review and next-step handoff"))
                .andExpect(jsonPath("$.whatChanged").value(org.hamcrest.Matchers.containsString("Original intent: Keep the original session plan intact across providers.")))
                .andExpect(jsonPath("$.whatChanged").value(org.hamcrest.Matchers.containsString("Latest snapshot: Built import and notification paths, next is the handoff flow.")))
                .andExpect(jsonPath("$.whatChanged").value(org.hamcrest.Matchers.containsString("Latest source session: CODEX / Codex planning session")))
                .andExpect(jsonPath("$.blockers").value("Need a compact summary of what changed."))
                .andExpect(jsonPath("$.nextAction").value("Generate a handoff draft for Claude review."))
                .andExpect(jsonPath("$.filesNote").value(org.hamcrest.Matchers.containsString("/Users/jean325/.codex/sessions/session-draft-1.json")));
    }
}
