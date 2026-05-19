package com.jean325.threadkeeper.provider.dto;

import com.jean325.threadkeeper.provider.domain.ProviderType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateProviderConnectionRequest(
        @NotNull ProviderType provider,
        @Size(max = 100) String accountLabel,
        @Size(max = 300) String homePath
) {
}
