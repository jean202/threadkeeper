package com.jean325.threadkeeper.thread.api;

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
class ThreadControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void createsAndReadsThread() throws Exception {
        String requestBody = """
                {
                  "projectKey": "threadkeeper",
                  "title": "Define MVP ingestion flow",
                  "priority": "HIGH",
                  "originalIntent": "Build a continuity layer for AI work sessions.",
                  "todayGoal": "Implement thread CRUD.",
                  "doneCondition": "Thread endpoints persist correctly."
                }
                """;

        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.projectKey").value("threadkeeper"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.currentNextAction").value("Implement thread CRUD."));

        mockMvc.perform(get("/api/v1/threads"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Define MVP ingestion flow"))
                // The list projection has to carry the goal fields; the Today screen
                // reads them straight off this response.
                .andExpect(jsonPath("$[0].todayGoal").value("Implement thread CRUD."))
                .andExpect(jsonPath("$[0].doneCondition").value("Thread endpoints persist correctly."))
                .andExpect(jsonPath("$[0].createdAt").exists());
    }

    @Test
    void updatesThreadStatusAndNextAction() throws Exception {
        String requestBody = """
                {
                  "projectKey": "threadkeeper",
                  "title": "Bridge inspect output",
                  "priority": "MEDIUM",
                  "originalIntent": "Normalize provider sessions.",
                  "todayGoal": "Implement parser.",
                  "doneCondition": "Canonical import payload is returned."
                }
                """;

        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isCreated());

        mockMvc.perform(patch("/api/v1/threads/1/next-action")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currentNextAction": "Parse provider artifacts into source sessions."
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentNextAction").value("Parse provider artifacts into source sessions."));

        mockMvc.perform(patch("/api/v1/threads/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "status": "COMPLETED"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.driftStatus").value("COMPLETED"));
    }

    @Test
    void readsThreadDetailWithRelatedArtifacts() throws Exception {
        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectKey": "threadkeeper",
                                  "title": "Thread detail target",
                                  "priority": "HIGH",
                                  "originalIntent": "Read one thread with full related context.",
                                  "todayGoal": "Assemble detail endpoint.",
                                  "doneCondition": "Related artifacts are returned together."
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/notification-rules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "ruleType": "DRIFT_ALERT",
                                  "enabled": true,
                                  "channel": "DISCORD",
                                  "thresholdMinutes": null,
                                  "scheduledTime": null,
                                  "configJson": "{}"
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/notification-rules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "ruleType": "COMPLETION",
                                  "enabled": true,
                                  "channel": "DISCORD",
                                  "thresholdMinutes": null,
                                  "scheduledTime": null,
                                  "configJson": "{}"
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
                                      "providerSessionKey": "detail-session-1",
                                      "sourceType": "sessions",
                                      "sourcePath": "/Users/jean325/.codex/sessions/detail-session-1.json",
                                      "title": "Detail import session",
                                      "metadataJson": "{\\"itemId\\":\\"codex:sessions:detail-1\\"}"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/threads/1/snapshots")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "snapshotType": "PROGRESS",
                                  "summary": "Built a full thread detail response.",
                                  "nextAction": "Verify the composite payload.",
                                  "blockers": "Need all related records in one response.",
                                  "driftScore": 8.00,
                                  "driftStatus": "ON_TRACK"
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/threads/1/handoffs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sourceSessionId": 1,
                                  "targetProvider": "CLAUDE",
                                  "reason": "Review the detail payload",
                                  "whatChanged": "Related records are now grouped in one response.",
                                  "blockers": "Need endpoint verification.",
                                  "nextAction": "Review the thread detail contract.",
                                  "filesNote": "threadkeeper-api",
                                  "status": "READY"
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(patch("/api/v1/threads/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "status": "COMPLETED"
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/threads/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Thread detail target"))
                .andExpect(jsonPath("$.todayGoal").value("Assemble detail endpoint."))
                .andExpect(jsonPath("$.sourceSessions[0].title").value("Detail import session"))
                .andExpect(jsonPath("$.snapshots[0].summary").value("Built a full thread detail response."))
                .andExpect(jsonPath("$.handoffs[0].reason").value("Review the detail payload"))
                .andExpect(jsonPath("$.notificationEvents[0].eventType").value("COMPLETION"))
                .andExpect(jsonPath("$.notificationEvents[1].eventType").value("DRIFT_ALERT"));
    }
}
