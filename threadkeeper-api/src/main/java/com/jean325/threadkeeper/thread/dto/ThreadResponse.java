package com.jean325.threadkeeper.thread.dto;

import com.jean325.threadkeeper.thread.domain.Thread;
import java.math.BigDecimal;
import java.time.Instant;

public record ThreadResponse(
        Long id,
        String projectKey,
        String title,
        String status,
        String priority,
        String originalIntent,
        String todayGoal,
        String doneCondition,
        String currentNextAction,
        String driftStatus,
        BigDecimal driftScore,
        Instant lastActivityAt,
        Instant completedAt,
        Instant createdAt
) {
    public static ThreadResponse from(Thread thread) {
        return new ThreadResponse(
                thread.getId(),
                thread.getProjectKey(),
                thread.getTitle(),
                thread.getStatus().name(),
                thread.getPriority().name(),
                thread.getOriginalIntent(),
                thread.getTodayGoal(),
                thread.getDoneCondition(),
                thread.getCurrentNextAction(),
                thread.getDriftStatus().name(),
                thread.getDriftScore(),
                thread.getLastActivityAt(),
                thread.getCompletedAt(),
                thread.getCreatedAt()
        );
    }
}
