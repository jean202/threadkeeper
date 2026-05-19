package com.jean325.threadkeeper.dashboard.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jean325.threadkeeper.thread.domain.DriftStatus;
import com.jean325.threadkeeper.thread.domain.ThreadRepository;
import com.jean325.threadkeeper.thread.domain.ThreadStatus;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
                .andExpect(jsonPath("$.blockedThreads[0]").value("Blocked thread"))
                .andExpect(jsonPath("$.completedToday[0]").value("Completed today"));
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
