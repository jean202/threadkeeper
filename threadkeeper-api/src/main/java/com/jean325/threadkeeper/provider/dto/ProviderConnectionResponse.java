package com.jean325.threadkeeper.provider.dto;

import com.jean325.threadkeeper.provider.domain.ProviderConnection;
import java.time.Instant;

public record ProviderConnectionResponse(
        Long id,
        String provider,
        String accountLabel,
        String homePath,
        String status,
        Instant lastImportAt,
        String lastErrorMessage,
        long importedSessionCount
) {
    public static ProviderConnectionResponse from(ProviderConnection connection) {
        return from(connection, 0L);
    }

    public static ProviderConnectionResponse from(ProviderConnection connection, long importedSessionCount) {
        return new ProviderConnectionResponse(
                connection.getId(),
                connection.getProvider().name(),
                connection.getAccountLabel(),
                connection.getHomePath(),
                connection.getStatus().name(),
                connection.getLastImportAt(),
                connection.getLastErrorMessage(),
                importedSessionCount
        );
    }
}
