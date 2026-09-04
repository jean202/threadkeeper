package com.jean325.threadkeeper.dashboard.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jean325.threadkeeper.thread.domain.DriftStatus;
import com.jean325.threadkeeper.thread.domain.ThreadRepository;
import com.jean325.threadkeeper.thread.domain.ThreadStatus;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.assertj.core.api.Assertions;
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
class DashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ThreadRepository threadRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void briefingRanksThreadsByPriorityDriftAndStaleness() throws Exception {
        createThread("High stale", "HIGH", "Resume urgent work");
        createThread("Drifting medium", "MEDIUM", "Narrow scope again");
        createThread("Missing next action", "HIGH", "");

        var highStale = threadRepository.findById(1L).orElseThrow();
        ReflectionTestUtils.setField(highStale, "lastActivityAt", Instant.now().minus(8, ChronoUnit.HOURS));
        threadRepository.save(highStale);

        var drifting = threadRepository.findById(2L).orElseThrow();
        ReflectionTestUtils.setField(drifting, "driftStatus", DriftStatus.DRIFTING);
        ReflectionTestUtils.setField(drifting, "lastActivityAt", Instant.now().minus(2, ChronoUnit.HOURS));
        threadRepository.save(drifting);

        var missing = threadRepository.findById(3L).orElseThrow();
        ReflectionTestUtils.setField(missing, "currentNextAction", null);
        threadRepository.save(missing);

        mockMvc.perform(get("/api/v1/dashboard/briefing"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.headline").value("Resume the highest-signal threads first"))
                .andExpect(jsonPath("$.threads[0].title").value("High stale"))
                .andExpect(jsonPath("$.threads[0].resumeReason").value("STALE"))
                .andExpect(jsonPath("$.threads[1].title").value("Drifting medium"))
                .andExpect(jsonPath("$.threads[1].resumeReason").value("DRIFTING"))
                .andExpect(jsonPath("$.threads[2].title").value("Missing next action"))
                .andExpect(jsonPath("$.threads[2].resumeReason").value("MISSING_NEXT_ACTION"));
    }

    @Test
    void todayIncludesBlockedAndCompletedAndRecommendedOrder() throws Exception {
        createThread("Blocked thread", "HIGH", "Unblock payment flow");
        createThread("Completed today", "MEDIUM", "Ship handoff flow");

        var blocked = threadRepository.findById(1L).orElseThrow();
        ReflectionTestUtils.setField(blocked, "status", ThreadStatus.BLOCKED);
        ReflectionTestUtils.setField(blocked, "driftStatus", DriftStatus.BLOCKED);
        threadRepository.save(blocked);

        var completed = threadRepository.findById(2L).orElseThrow();
        completed.updateStatus(ThreadStatus.COMPLETED);
        threadRepository.save(completed);

        mockMvc.perform(get("/api/v1/dashboard/today"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blockedThreads[0].title").value("Blocked thread"))
                .andExpect(jsonPath("$.completedToday[0].title").value("Completed today"))
                // A finished thread must not advertise itself as resumable.
                .andExpect(jsonPath("$.completedToday[0].resumeReason").value("COMPLETED"));
    }

    @Test
    void todayThreadsCarryIdentityAndResumeContextSoTheUiCanLinkToThem() throws Exception {
        createThread("Blocked thread", "HIGH", "Unblock payment flow");
        createThread("Still active", "MEDIUM", "Keep going");

        var blocked = threadRepository.findById(1L).orElseThrow();
        ReflectionTestUtils.setField(blocked, "status", ThreadStatus.BLOCKED);
        ReflectionTestUtils.setField(blocked, "driftStatus", DriftStatus.BLOCKED);
        threadRepository.save(blocked);

        mockMvc.perform(get("/api/v1/dashboard/today"))
                .andExpect(status().isOk())
                // Without threadId the dashboard cannot link anywhere, which is the
                // whole point of the Today screen.
                .andExpect(jsonPath("$.blockedThreads[0].threadId").value(1))
                .andExpect(jsonPath("$.blockedThreads[0].status").value("BLOCKED"))
                .andExpect(jsonPath("$.blockedThreads[0].resumeReason").value("BLOCKED"))
                .andExpect(jsonPath("$.blockedThreads[0].driftStatus").value("BLOCKED"))
                .andExpect(jsonPath("$.blockedThreads[0].nextAction").value("Unblock payment flow"))
                .andExpect(jsonPath("$.activeThreads[0].threadId").value(2))
                .andExpect(jsonPath("$.activeThreads[0].title").value("Still active"))
                .andExpect(jsonPath("$.activeThreads[0].resumeReason").exists())
                // recommendedOrder carries ids, resolved against activeThreads.
                .andExpect(jsonPath("$.recommendedOrder[0]").value(2));
    }

    /**
     * Every id in recommendedOrder has to be findable in activeThreads --
     * otherwise the client cannot render the ranking at all.
     */
    @Test
    void recommendedOrderIsIdsThatAllAppearInActiveThreads() throws Exception {
        createThread("First", "HIGH", "Do the thing");
        createThread("Second", "LOW", "Do the other thing");

        String body = mockMvc.perform(get("/api/v1/dashboard/today"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        var root = objectMapper.readTree(body);
        var order = root.get("recommendedOrder");
        var activeIds = root.get("activeThreads").findValues("threadId").stream()
                .map(JsonNode::asLong)
                .toList();

        Assertions.assertThat(order.size()).isEqualTo(activeIds.size());
        for (var id : order) {
            Assertions.assertThat(id.isNumber()).isTrue();
            Assertions.assertThat(activeIds).contains(id.asLong());
        }
    }

    @Test
    void statusBlockedAloneIsEnoughToReportABlockedResumeReason() throws Exception {
        createThread("Blocked by status only", "MEDIUM", "Get the webhook URL");

        // updateStatus only touches driftStatus on COMPLETED, so a thread parked via
        // PATCH /status keeps driftStatus=ON_TRACK. It still belongs in the blocked
        // section, and must not read as "READY" there.
        var blocked = threadRepository.findById(1L).orElseThrow();
        ReflectionTestUtils.setField(blocked, "status", ThreadStatus.BLOCKED);
        threadRepository.save(blocked);

        mockMvc.perform(get("/api/v1/dashboard/today"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blockedThreads[0].driftStatus").value("ON_TRACK"))
                .andExpect(jsonPath("$.blockedThreads[0].resumeReason").value("BLOCKED"));
    }

    private void createThread(String title, String priority, String nextAction) throws Exception {
        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectKey": "threadkeeper",
                                  "title": "%s",
                                  "priority": "%s",
                                  "originalIntent": "Preserve the original plan across sessions.",
                                  "todayGoal": "Move the thread forward.",
                                  "doneCondition": "A useful dashboard ordering exists."
                                }
                                """.formatted(title, priority)))
                .andExpect(status().isCreated());

        if (nextAction != null) {
            var created = threadRepository.findTopByTitleIgnoreCaseOrderByLastActivityAtDesc(title);
            ReflectionTestUtils.setField(created, "currentNextAction", nextAction.isBlank() ? null : nextAction);
            threadRepository.save(created);
        }
    }
}
