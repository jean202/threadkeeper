package com.jean325.threadkeeper.handoff.dto;

import com.jean325.threadkeeper.provider.domain.ProviderType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record GenerateHandoffDraftRequest(
        Long sourceSessionId,
        @NotNull ProviderType targetProvider,
        @Size(max = 100) String reasonHint
) {
}
