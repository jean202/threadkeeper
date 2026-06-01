package com.jean325.threadkeeper.provider.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ImportSourceSessionsRequest(
        @NotBlankOrNull String profile,
        boolean includeSensitive,
        @NotNull @NotEmpty @Valid List<SourceSessionImportRequest> sourceSessions
) {
    public record SourceSessionImportRequest(
            Long threadId,
            @Size(max = 100) String projectKey,
            @NotNull String provider,
            @NotNull @Size(max = 200) String providerSessionKey,
            @NotNull @Size(max = 50) String sourceType,
            @Size(max = 500) String sourcePath,
            @Size(max = 200) String title,
            String metadataJson,
            String originalIntent,
            String nextAction,
            String startedAt,
            String lastActivityAt
    ) {
    }
}
