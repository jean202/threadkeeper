package com.jean325.threadkeeper.dashboard.dto;

import java.time.Instant;
import java.util.List;

public record TodayDashboardResponse(
        List<DashboardThread> activeThreads,
        List<DashboardThread> staleThreads,
        List<DashboardThread> blockedThreads,
        List<DashboardThread> completedToday,
        List<Long> recommendedOrder
) {
    /**
     * Thread ids in resume-priority order. Callers render the ordering by looking each id up in
     * {@link #activeThreads()}, so the ranked list stays a projection instead of a second copy.
     */
    public record DashboardThread(
            Long threadId,
            String projectKey,
            String title,
            String status,
            String priority,
            String driftStatus,
            String nextAction,
            String resumeReason,
            Long staleMinutes,
            Instant lastActivityAt,
            Instant completedAt
    ) {
    }
}
