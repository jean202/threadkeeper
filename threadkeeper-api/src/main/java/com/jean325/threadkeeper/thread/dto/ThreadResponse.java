package com.jean325.threadkeeper.thread.dto;

import com.jean325.threadkeeper.thread.domain.Thread;
import java.time.Instant;

public record ThreadResponse(
        Long id,
        String projectKey,
        String title,
        String status,
        String priority,
        String originalIntent,
        String currentNextAction,
        String driftStatus,
        Instant lastActivityAt
) {
    public static ThreadResponse from(Thread thread) {
        return new ThreadResponse(
                thread.getId(),
                thread.getProjectKey(),
                thread.getTitle(),
                thread.getStatus().name(),
                thread.getPriority().name(),
                thread.getOriginalIntent(),
                thread.getCurrentNextAction(),
                thread.getDriftStatus().name(),
                thread.getLastActivityAt()
        );
    }
}
