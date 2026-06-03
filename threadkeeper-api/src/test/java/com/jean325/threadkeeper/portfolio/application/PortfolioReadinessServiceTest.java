package com.jean325.threadkeeper.portfolio.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jean325.threadkeeper.portfolio.domain.PortfolioProperties;
import com.jean325.threadkeeper.portfolio.dto.PortfolioReadinessResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class PortfolioReadinessServiceTest {

    private final Instant now = Instant.parse("2026-06-03T00:00:00Z");
    private final Clock clock = Clock.fixed(now, ZoneOffset.UTC);

    private PortfolioReadinessService serviceWith(
            boolean enabled, long staleMaxDays, List<PortfolioScanEntry> entries) {
        PortfolioProperties props = new PortfolioProperties();
        props.setEnabled(enabled);
        props.setStaleMaxDays(staleMaxDays);
        PortfolioScanFileReader reader = new PortfolioScanFileReader(props, new ObjectMapper()) {
            @Override
            public synchronized List<PortfolioScanEntry> read() {
                return entries;
            }
        };
        return new PortfolioReadinessService(props, reader, clock);
    }

    @Test
    void returnsEmptyWhenDisabled() {
        var service = serviceWith(false, 14, List.of(
                new PortfolioScanEntry("threadkeeper", 80, 70, "2026-06-03T00:00:00Z")));
        assertThat(service.listReadiness()).isEmpty();
    }

    @Test
    void normalizesNameToProjectKey() {
        var service = serviceWith(true, 14, List.of(
                new PortfolioScanEntry("  ThreadKeeper ", 82, 71, "2026-06-02T00:00:00Z")));
        List<PortfolioReadinessResponse> result = service.listReadiness();
        assertThat(result).hasSize(1);
        assertThat(result.get(0).projectKey()).isEqualTo("threadkeeper");
        assertThat(result.get(0).readiness()).isEqualTo(82);
        assertThat(result.get(0).baseReadiness()).isEqualTo(71);
    }

    @Test
    void marksStaleWhenOlderThanStaleMaxDays() {
        var service = serviceWith(true, 14, List.of(
                new PortfolioScanEntry("a", 50, 50, "2026-05-14T00:00:00Z")));
        var r = service.listReadiness().get(0);
        assertThat(r.ageDays()).isEqualTo(20);
        assertThat(r.stale()).isTrue();
    }

    @Test
    void notStaleWhenWithinStaleMaxDays() {
        var service = serviceWith(true, 14, List.of(
                new PortfolioScanEntry("a", 50, 50, "2026-05-30T00:00:00Z")));
        var r = service.listReadiness().get(0);
        assertThat(r.ageDays()).isEqualTo(4);
        assertThat(r.stale()).isFalse();
    }

    @Test
    void handlesUnparseableScannedAt() {
        var service = serviceWith(true, 14, List.of(
                new PortfolioScanEntry("a", 50, 50, "not-a-date")));
        var r = service.listReadiness().get(0);
        assertThat(r.scannedAt()).isNull();
        assertThat(r.ageDays()).isEqualTo(-1);
        assertThat(r.stale()).isFalse();
    }

    @Test
    void notStaleAtExactlyStaleMaxDaysBoundary() {
        // 2026-05-20 is exactly 14 days before now; stale uses strict > so this is NOT stale
        var service = serviceWith(true, 14, List.of(
                new PortfolioScanEntry("a", 50, 50, "2026-05-20T00:00:00Z")));
        var r = service.listReadiness().get(0);
        assertThat(r.ageDays()).isEqualTo(14);
        assertThat(r.stale()).isFalse();
    }

    @Test
    void handlesNullScannedAt() {
        var service = serviceWith(true, 14, List.of(
                new PortfolioScanEntry("a", 50, 50, null)));
        var r = service.listReadiness().get(0);
        assertThat(r.scannedAt()).isNull();
        assertThat(r.ageDays()).isEqualTo(-1);
        assertThat(r.stale()).isFalse();
    }
}
