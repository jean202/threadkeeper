package com.jean325.threadkeeper.dashboard.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * One thread as the dashboard presents it: enough to rank it, explain why it
 * surfaced, and link straight to it. Shared by the today and briefing views so
 * both speak the same shape.
 */
public record DashboardThread(
        Long threadId,
        String title,
        String priority,
        String status,
        String driftStatus,
        BigDecimal driftScore,
        String nextAction,
        String resumeReason,
        long staleMinutes,
        int score,
        Instant lastActivityAt
) {
}
