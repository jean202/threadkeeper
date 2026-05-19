package com.jean325.threadkeeper.provider.dto;

import java.util.List;

public record BridgeImportPayload(
        String importedAt,
        List<String> providers,
        List<SourceSessionPayload> sourceSessions
) {
    public record SourceSessionPayload(
            String provider,
            String providerSessionKey,
            String sourceType,
            String sourcePath,
            String title,
            String importedAt,
            String metadataJson
    ) {
    }
}
