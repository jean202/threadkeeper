package com.jean325.threadkeeper.dashboard.dto;

import java.time.Instant;
import java.util.List;

public record BriefingResponse(
        String headline,
        List<BriefingThread> threads
) {
    public record BriefingThread(
            Long threadId,
            String title,
            String priority,
            String driftStatus,
            String nextAction,
            String resumeReason,
            long staleMinutes,
            int score,
            Instant lastActivityAt
    ) {
    }
}
