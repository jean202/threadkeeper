package com.jean325.threadkeeper.provider.application;

import com.jean325.threadkeeper.provider.dto.ProviderConnectionResponse;
import com.jean325.threadkeeper.provider.dto.RunProviderImportRequest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AutomaticImportScheduler {

    private static final Logger log = LoggerFactory.getLogger(AutomaticImportScheduler.class);

    private final ProviderConnectionService providerConnectionService;
    private final ImportSchedulerProperties properties;
    private final Clock clock;

    private volatile Instant lastAttempt;

    public AutomaticImportScheduler(
            ProviderConnectionService providerConnectionService,
            ImportSchedulerProperties properties,
            Clock clock
    ) {
        this.providerConnectionService = providerConnectionService;
        this.properties = properties;
        this.clock = clock;
    }

    @Scheduled(
            initialDelayString = "${threadkeeper.import-scheduler.check-delay-ms:3600000}",
            fixedDelayString = "${threadkeeper.import-scheduler.check-delay-ms:3600000}"
    )
    public void runDueImport() {
        if (!properties.isEnabled()) {
            return;
        }
        if (properties.getMigratorPath() == null || properties.getMigratorPath().isBlank()) {
            log.warn("Automatic import enabled but migrator-path is blank; skipping.");
            return;
        }

        ProviderConnectionResponse connection = findActiveConnection(properties.getConnectionId());
        if (connection == null) {
            log.warn(
                    "Automatic import: connection id={} not found or not ACTIVE; skipping.",
                    properties.getConnectionId()
            );
            return;
        }

        if (!shouldRun(connection)) {
            return;
        }

        // Stamp before the attempt so a failed import also opens the throttle window
        // (failed imports roll back, so lastImportAt would otherwise stay stale and retry every tick).
        lastAttempt = clock.instant();
        try {
            providerConnectionService.runImport(
                    connection.id(),
                    new RunProviderImportRequest(
                            properties.getMigratorPath(),
                            properties.getBridgePath(),
                            properties.getProfile(),
                            properties.getTarget(),
                            properties.isIncludeSensitive()
                    )
            );
            log.info("Automatic import completed for connection id={}.", connection.id());
        } catch (Exception e) {
            log.warn("Automatic import failed for connection id={}: {}", connection.id(), e.getMessage());
        }
    }

    private ProviderConnectionResponse findActiveConnection(long connectionId) {
        return providerConnectionService.listConnections().stream()
                .filter(c -> c.id() != null && c.id().equals(connectionId))
                .filter(c -> "ACTIVE".equals(c.status()))
                .findFirst()
                .orElse(null);
    }

    private boolean shouldRun(ProviderConnectionResponse connection) {
        Instant cutoff = clock.instant().minus(Duration.ofHours(properties.getStalenessThresholdHours()));
        boolean importStale = connection.lastImportAt() == null || connection.lastImportAt().isBefore(cutoff);
        boolean attemptStale = lastAttempt == null || lastAttempt.isBefore(cutoff);
        return importStale && attemptStale;
    }
}
