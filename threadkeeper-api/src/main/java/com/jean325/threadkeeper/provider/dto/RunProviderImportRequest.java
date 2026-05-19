package com.jean325.threadkeeper.provider.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RunProviderImportRequest(
        @NotBlank @Size(max = 500) String migratorPath,
        @Size(max = 500) String bridgePath,
        @NotBlankOrNull String profile,
        @NotBlankOrNull String target,
        boolean includeSensitive
) {
}
