package com.jean325.threadkeeper.portfolio.application;

import com.jean325.threadkeeper.portfolio.domain.PortfolioProperties;
import com.jean325.threadkeeper.portfolio.dto.PortfolioReadinessResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;

@Service
public class PortfolioReadinessService {

    private final PortfolioProperties properties;
    private final PortfolioScanFileReader reader;
    private final Clock clock;

    public PortfolioReadinessService(
            PortfolioProperties properties,
            PortfolioScanFileReader reader,
            Clock clock
    ) {
        this.properties = properties;
        this.reader = reader;
        this.clock = clock;
    }

    public List<PortfolioReadinessResponse> listReadiness() {
        if (!properties.isEnabled()) {
            return List.of();
        }
        Instant now = clock.instant();
        List<PortfolioReadinessResponse> result = new ArrayList<>();
        for (PortfolioScanEntry entry : reader.read()) {
            String projectKey = entry.name().trim().toLowerCase(Locale.ROOT);
            Instant scannedAt = parseInstant(entry.scannedAt());
            long ageDays = scannedAt == null ? -1 : Duration.between(scannedAt, now).toDays();
            boolean stale = ageDays >= 0 && ageDays > properties.getStaleMaxDays();
            PortfolioScanEntry.GitActivity git = entry.gitActivity();
            Integer daysSinceLastCommit = git == null ? null : git.daysSinceLastCommit();
            Boolean active = git == null ? null : git.active();
            Instant lastCommitDate = git == null ? null : parseInstant(git.lastCommitDate());
            result.add(new PortfolioReadinessResponse(
                    projectKey,
                    entry.readiness(),
                    entry.baseReadiness(),
                    scannedAt,
                    stale,
                    ageDays,
                    daysSinceLastCommit,
                    active,
                    lastCommitDate
            ));
        }
        return List.copyOf(result);
    }

    private Instant parseInstant(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
