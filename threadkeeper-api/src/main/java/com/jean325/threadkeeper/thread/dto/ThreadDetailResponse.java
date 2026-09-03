package com.jean325.threadkeeper.thread.dto;

import com.jean325.threadkeeper.handoff.dto.HandoffResponse;
import com.jean325.threadkeeper.notification.dto.NotificationEventResponse;
import com.jean325.threadkeeper.snapshot.dto.ThreadSnapshotResponse;
import com.jean325.threadkeeper.source.dto.SourceSessionResponse;
import com.jean325.threadkeeper.thread.domain.Thread;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record ThreadDetailResponse(
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
        Instant createdAt,
        List<SourceSessionResponse> sourceSessions,
        List<ThreadSnapshotResponse> snapshots,
        List<HandoffResponse> handoffs,
        List<NotificationEventResponse> notificationEvents
) {
    public static ThreadDetailResponse from(
            Thread thread,
            List<SourceSessionResponse> sourceSessions,
            List<ThreadSnapshotResponse> snapshots,
            List<HandoffResponse> handoffs,
            List<NotificationEventResponse> notificationEvents
    ) {
        return new ThreadDetailResponse(
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
                thread.getCreatedAt(),
                sourceSessions,
                snapshots,
                handoffs,
                notificationEvents
        );
    }
}
