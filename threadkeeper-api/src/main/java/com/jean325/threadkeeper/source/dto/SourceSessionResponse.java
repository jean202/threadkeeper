package com.jean325.threadkeeper.source.dto;

import com.jean325.threadkeeper.source.domain.SourceSession;
import java.time.Instant;

public record SourceSessionResponse(
        Long id,
        Long threadId,
        Long providerConnectionId,
        String provider,
        String providerSessionKey,
        String sourceType,
        String sourcePath,
        String title,
        Instant importedAt,
        String metadataJson
) {
    public static SourceSessionResponse from(SourceSession sourceSession) {
        return new SourceSessionResponse(
                sourceSession.getId(),
                sourceSession.getThread() == null ? null : sourceSession.getThread().getId(),
                sourceSession.getProviderConnection().getId(),
                sourceSession.getProvider().name(),
                sourceSession.getProviderSessionKey(),
                sourceSession.getSourceType(),
                sourceSession.getSourcePath(),
                sourceSession.getTitle(),
                sourceSession.getImportedAt(),
                sourceSession.getMetadataJson()
        );
    }
}
