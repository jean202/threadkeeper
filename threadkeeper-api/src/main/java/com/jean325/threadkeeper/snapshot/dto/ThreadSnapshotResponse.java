package com.jean325.threadkeeper.snapshot.dto;

import com.jean325.threadkeeper.snapshot.domain.ThreadSnapshot;
import java.math.BigDecimal;
import java.time.Instant;

public record ThreadSnapshotResponse(
        Long id,
        Long threadId,
        String snapshotType,
        String summary,
        String nextAction,
        String blockers,
        BigDecimal driftScore,
        String driftStatus,
        Instant createdAt
) {
    public static ThreadSnapshotResponse from(ThreadSnapshot snapshot) {
        return new ThreadSnapshotResponse(
                snapshot.getId(),
                snapshot.getThread().getId(),
                snapshot.getSnapshotType().name(),
                snapshot.getSummary(),
                snapshot.getNextAction(),
                snapshot.getBlockers(),
                snapshot.getDriftScore(),
                snapshot.getDriftStatus() == null ? null : snapshot.getDriftStatus().name(),
                snapshot.getCreatedAt()
        );
    }
}
