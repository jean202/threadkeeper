package com.jean325.threadkeeper.provider.dto;

import com.jean325.threadkeeper.source.dto.SourceSessionResponse;
import java.time.Instant;
import java.util.List;

/**
 * Ingestion status for one provider connection: what the last import produced and whether it
 * failed. {@code lastImportAt} is the connection's own bookkeeping, while
 * {@code latestSessionImportedAt} comes from the imported rows, so a run that imported nothing
 * leaves the two apart.
 */
public record LatestImportResponse(
        Long connectionId,
        String provider,
        String status,
        Instant lastImportAt,
        String lastErrorMessage,
        long importedSessionCount,
        long linkedThreadCount,
        Instant latestSessionImportedAt,
        List<SourceSessionResponse> recentSessions
) {
}
