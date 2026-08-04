package com.jean325.threadkeeper.drift.api;

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
class DriftControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void aFreshThreadIsNotMarkedDriftingBeforeAnyActivity() throws Exception {
        createThread("Implement billing webhook retry logic");

        mockMvc.perform(post("/api/v1/threads/1/drift-evaluation"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conclusive").value(false))
                .andExpect(jsonPath("$.driftStatus").value("ON_TRACK"))
                .andExpect(jsonPath("$.driftScore").doesNotExist());
    }

    @Test
    void unrelatedProgressMarksTheThreadDrifting() throws Exception {
        createThread("Implement billing webhook retry logic");
        addSnapshot("Renamed components and reworked the css theme.");

        // The snapshot alone should have moved it; the endpoint just confirms.
        mockMvc.perform(get("/api/v1/threads/1"))
                .andExpect(jsonPath("$.driftStatus").value("DRIFTING"))
                .andExpect(jsonPath("$.driftScore").value(100.00));

        mockMvc.perform(post("/api/v1/threads/1/drift-evaluation"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conclusive").value(true))
                .andExpect(jsonPath("$.driftStatus").value("DRIFTING"));
    }

    @Test
    void progressOnTopicKeepsTheThreadOnTrack() throws Exception {
        createThread("Implement billing webhook retry logic");
        addSnapshot("Added retry backoff to the billing webhook handler.");

        mockMvc.perform(get("/api/v1/threads/1"))
                .andExpect(jsonPath("$.driftStatus").value("ON_TRACK"))
                .andExpect(jsonPath("$.driftScore").value(40.00));
    }

    @Test
    void returningToTheOriginalTopicClearsTheDriftWarning() throws Exception {
        createThread("Implement billing webhook retry logic");
        addSnapshot("Renamed components and reworked the css theme.");
        mockMvc.perform(get("/api/v1/threads/1"))
                .andExpect(jsonPath("$.driftStatus").value("DRIFTING"));

        addSnapshot("Back on the billing webhook retry logic.");

        mockMvc.perform(get("/api/v1/threads/1"))
                .andExpect(jsonPath("$.driftStatus").value("ON_TRACK"));
    }

    @Test
    void completedAndBlockedThreadsKeepTheirOwnDriftStatus() throws Exception {
        createThread("Implement billing webhook retry logic");
        addSnapshot("Renamed components and reworked the css theme.");

        mockMvc.perform(patch("/api/v1/threads/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"BLOCKED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.driftStatus").value("BLOCKED"));

        // Re-evaluating must not overwrite BLOCKED with a drift verdict.
        mockMvc.perform(post("/api/v1/threads/1/drift-evaluation"))
                .andExpect(jsonPath("$.driftStatus").value("BLOCKED"));

        mockMvc.perform(patch("/api/v1/threads/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"COMPLETED\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/threads/1/drift-evaluation"))
                .andExpect(jsonPath("$.driftStatus").value("COMPLETED"));
    }

    @Test
    void reopeningAThreadLetsDriftSpeakAgain() throws Exception {
        createThread("Implement billing webhook retry logic");
        addSnapshot("Renamed components and reworked the css theme.");
        mockMvc.perform(patch("/api/v1/threads/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"COMPLETED\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/threads/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"ACTIVE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.driftStatus").value("ON_TRACK"));

        mockMvc.perform(post("/api/v1/threads/1/drift-evaluation"))
                .andExpect(jsonPath("$.driftStatus").value("DRIFTING"));
    }

    @Test
    void rejectsAnUnknownThread() throws Exception {
        mockMvc.perform(post("/api/v1/threads/999/drift-evaluation"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("THREAD_NOT_FOUND"));
    }

    private void createThread(String originalIntent) throws Exception {
        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectKey": "threadkeeper",
                                  "title": "Drift thread",
                                  "priority": "HIGH",
                                  "originalIntent": "%s",
                                  "todayGoal": "Move it forward.",
                                  "doneCondition": "Retries land."
                                }
                                """.formatted(originalIntent)))
                .andExpect(status().isCreated());
    }

    private void addSnapshot(String summary) throws Exception {
        mockMvc.perform(post("/api/v1/threads/1/snapshots")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "snapshotType": "PROGRESS",
                                  "summary": "%s"
                                }
                                """.formatted(summary)))
                .andExpect(status().isCreated());
    }
}
