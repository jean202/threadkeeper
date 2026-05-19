package com.jean325.threadkeeper.handoff.dto;

import com.jean325.threadkeeper.handoff.domain.Handoff;
import java.time.Instant;

public record HandoffResponse(
        Long id,
        Long threadId,
        Long sourceSessionId,
        String targetProvider,
        String reason,
        String whatChanged,
        String blockers,
        String nextAction,
        String filesNote,
        String status,
        Instant createdAt
) {
    public static HandoffResponse from(Handoff handoff) {
        return new HandoffResponse(
                handoff.getId(),
                handoff.getThread().getId(),
                handoff.getSourceSession() == null ? null : handoff.getSourceSession().getId(),
                handoff.getTargetProvider().name(),
                handoff.getReason(),
                handoff.getWhatChanged(),
                handoff.getBlockers(),
                handoff.getNextAction(),
                handoff.getFilesNote(),
                handoff.getStatus().name(),
                handoff.getCreatedAt()
        );
    }
}
