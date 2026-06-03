package com.jean325.threadkeeper.portfolio.dto;

import java.time.Instant;

public record PortfolioReadinessResponse(
        String projectKey,
        int readiness,
        int baseReadiness,
        Instant scannedAt,
        boolean stale,
        long ageDays
) {
}
