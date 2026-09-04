package com.jean325.threadkeeper.provider.dto;

import com.jean325.threadkeeper.source.dto.SourceSessionResponse;
import java.time.Instant;
import java.util.List;

/**
 * Ingestion status for one provider connection: what the last import produced
 * and whether it failed.
 *
 * <p>{@code lastImportAt} is the connection's own bookkeeping -- when a run was
 * last attempted -- while {@code latestSessionImportedAt} comes from the
 * imported rows. A run that found nothing new moves the first and leaves the
 * second alone, and that gap is exactly what tells a "nothing to import" run
 * apart from one that never happened.
 */
public record LatestImportResponse(
        Long connectionId,
        String provider,
        String status,
        Instant lastImportAt,
        String lastErrorMessage,
        long importedSessionCount,
        /** Distinct threads these sessions were attached to; a session may be unlinked. */
        long linkedThreadCount,
        /** Null when the connection has never imported a session. */
        Instant latestSessionImportedAt,
        List<SourceSessionResponse> recentSessions
) {
}
