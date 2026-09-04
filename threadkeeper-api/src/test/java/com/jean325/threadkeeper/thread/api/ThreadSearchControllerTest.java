package com.jean325.threadkeeper.thread.api;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jean325.threadkeeper.thread.domain.ThreadRepository;
import com.jean325.threadkeeper.thread.domain.ThreadStatus;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class ThreadSearchControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ThreadRepository threadRepository;

    @BeforeEach
    void seed() throws Exception {
        createThread("billing", "Billing webhook retries", "Implement billing webhook retry logic",
                "Ship retries");
        createThread("billing", "Invoice PDF export", "Export invoices as PDF", "Pick a renderer");
        createThread("threadkeeper", "Drift detection", "Compare activity with the original intent",
                "Tune the threshold");
    }

    @Test
    void withoutFiltersItStillListsEverything() throws Exception {
        mockMvc.perform(get("/api/v1/threads"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    void filtersByProject() throws Exception {
        mockMvc.perform(get("/api/v1/threads").param("projectKey", "billing"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[*].projectKey", Matchers.everyItem(Matchers.is("billing"))));
    }

    @Test
    void projectMatchingIgnoresCase() throws Exception {
        mockMvc.perform(get("/api/v1/threads").param("projectKey", "BILLING"))
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void filtersByStatus() throws Exception {
        var completed = threadRepository.findTopByTitleIgnoreCaseOrderByLastActivityAtDesc("Invoice PDF export");
        completed.updateStatus(ThreadStatus.COMPLETED);
        threadRepository.save(completed);

        mockMvc.perform(get("/api/v1/threads").param("status", "COMPLETED"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Invoice PDF export"));

        mockMvc.perform(get("/api/v1/threads").param("status", "ACTIVE"))
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void keywordLooksBeyondTheTitle() throws Exception {
        // "retry" appears in one title and in another thread's original intent.
        mockMvc.perform(get("/api/v1/threads").param("q", "retry"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Billing webhook retries"));

        // Matches on the next action, which no title contains.
        mockMvc.perform(get("/api/v1/threads").param("q", "renderer"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Invoice PDF export"));

        // And on the original intent.
        mockMvc.perform(get("/api/v1/threads").param("q", "original intent"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Drift detection"));
    }

    @Test
    void keywordIgnoresCase() throws Exception {
        mockMvc.perform(get("/api/v1/threads").param("q", "BILLING WEBHOOK"))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void filtersByRecency() throws Exception {
        var stale = threadRepository.findTopByTitleIgnoreCaseOrderByLastActivityAtDesc("Drift detection");
        ReflectionTestUtils.setField(stale, "lastActivityAt", Instant.now().minus(10, ChronoUnit.DAYS));
        threadRepository.save(stale);

        mockMvc.perform(get("/api/v1/threads").param("activeWithinDays", "7"))
                .andExpect(jsonPath("$.length()").value(2));

        mockMvc.perform(get("/api/v1/threads").param("activeWithinDays", "30"))
                .andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    void aThreadWithNoRecordedActivityIsNotConsideredRecent() throws Exception {
        var never = threadRepository.findTopByTitleIgnoreCaseOrderByLastActivityAtDesc("Drift detection");
        ReflectionTestUtils.setField(never, "lastActivityAt", null);
        threadRepository.save(never);

        mockMvc.perform(get("/api/v1/threads").param("activeWithinDays", "7"))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[*].title", Matchers.not(Matchers.hasItem("Drift detection"))));
    }

    @Test
    void filtersByProviderThroughTheImportedSessions() throws Exception {
        importSessionForThread(1L, "CODEX", "codex-1");

        mockMvc.perform(get("/api/v1/threads").param("provider", "CODEX"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Billing webhook retries"));

        // No thread has a Claude session, so the filter returns nothing rather
        // than falling back to everything.
        mockMvc.perform(get("/api/v1/threads").param("provider", "CLAUDE"))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void combinesFilters() throws Exception {
        mockMvc.perform(get("/api/v1/threads")
                        .param("projectKey", "billing")
                        .param("q", "invoice"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Invoice PDF export"));

        // The project excludes the only keyword match, so the result is empty.
        mockMvc.perform(get("/api/v1/threads")
                        .param("projectKey", "threadkeeper")
                        .param("q", "invoice"))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void blankParametersDoNotFilterAnything() throws Exception {
        mockMvc.perform(get("/api/v1/threads").param("q", "   ").param("projectKey", ""))
                .andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    void resultsStayInMostRecentlyActiveOrder() throws Exception {
        var oldest = threadRepository.findTopByTitleIgnoreCaseOrderByLastActivityAtDesc("Billing webhook retries");
        ReflectionTestUtils.setField(oldest, "lastActivityAt", Instant.now().minus(5, ChronoUnit.HOURS));
        threadRepository.save(oldest);

        mockMvc.perform(get("/api/v1/threads").param("projectKey", "billing"))
                .andExpect(jsonPath("$[0].title").value("Invoice PDF export"))
                .andExpect(jsonPath("$[1].title").value("Billing webhook retries"));
    }

    @Test
    void filtersByPriority() throws Exception {
        // The shared seed is all MEDIUM, so this test brings its own HIGH thread.
        createThread("billing", "Escalate refunds", "Handle refund escalations", "Draft the flow", "HIGH");

        mockMvc.perform(get("/api/v1/threads").param("priority", "HIGH"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Escalate refunds"));

        mockMvc.perform(get("/api/v1/threads").param("priority", "MEDIUM"))
                .andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    void rejectsAnUnknownEnumValue() throws Exception {
        mockMvc.perform(get("/api/v1/threads").param("status", "NOT_A_STATUS"))
                .andExpect(status().isBadRequest());
    }

    /**
     * The web client renders errors from this shape, so a bad filter has to
     * arrive in it rather than in Spring's default body.
     */
    @Test
    void describesAnUnknownEnumValueInTheApiErrorShape() throws Exception {
        mockMvc.perform(get("/api/v1/threads").param("status", "NOT_A_STATUS"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("status"))
                .andExpect(jsonPath("$.fieldErrors[0].reason").value(containsString("ACTIVE")));
    }

    private void createThread(String projectKey, String title, String intent, String todayGoal)
            throws Exception {
        createThread(projectKey, title, intent, todayGoal, "MEDIUM");
    }

    private void createThread(String projectKey, String title, String intent, String todayGoal,
            String priority) throws Exception {
        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectKey": "%s",
                                  "title": "%s",
                                  "priority": "%s",
                                  "originalIntent": "%s",
                                  "todayGoal": "%s",
                                  "doneCondition": "Done."
                                }
                                """.formatted(projectKey, title, priority, intent, todayGoal)))
                .andExpect(status().isCreated());
    }

    private void importSessionForThread(Long threadId, String provider, String sessionKey) throws Exception {
        mockMvc.perform(post("/api/v1/provider-connections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"provider": "%s", "accountLabel": "default", "homePath": "/home/user"}
                                """.formatted(provider)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/provider-connections/1/imports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "profile": "full",
                                  "includeSensitive": false,
                                  "sourceSessions": [
                                    {
                                      "threadId": %d,
                                      "projectKey": "billing",
                                      "provider": "%s",
                                      "providerSessionKey": "%s",
                                      "sourceType": "rollout",
                                      "sourcePath": "/tmp/%s.jsonl",
                                      "title": "Imported session",
                                      "metadataJson": "{}"
                                    }
                                  ]
                                }
                                """.formatted(threadId, provider, sessionKey, sessionKey)))
                .andExpect(status().isCreated());
    }
}
