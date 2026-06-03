package com.jean325.threadkeeper.provider.application;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.jean325.threadkeeper.provider.dto.ProviderConnectionResponse;
import com.jean325.threadkeeper.provider.dto.RunProviderImportRequest;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

class AutomaticImportSchedulerTest {

    private final Instant now = Instant.parse("2026-06-03T09:00:00Z");
    private final Clock clock = Clock.fixed(now, ZoneOffset.UTC);

    private ImportSchedulerProperties props(boolean enabled, String migratorPath) {
        ImportSchedulerProperties p = new ImportSchedulerProperties();
        p.setEnabled(enabled);
        p.setConnectionId(1L);
        p.setTarget("codex,claude");
        p.setMigratorPath(migratorPath);
        p.setBridgePath("/bridge");
        p.setProfile("full");
        p.setIncludeSensitive(false);
        p.setStalenessThresholdHours(20);
        return p;
    }

    private ProviderConnectionResponse connection(long id, String status, Instant lastImportAt) {
        return new ProviderConnectionResponse(id, "CODEX", "default", "/home", status, lastImportAt, null);
    }

    @Test
    void disabledDoesNotImport() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        var scheduler = new AutomaticImportScheduler(service, props(false, "/migrator"), clock);

        scheduler.runDueImport();

        verify(service, never()).runImport(any(), any());
    }

    @Test
    void blankMigratorPathDoesNotImport() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        var scheduler = new AutomaticImportScheduler(service, props(true, "  "), clock);

        scheduler.runDueImport();

        verify(service, never()).runImport(any(), any());
    }

    @Test
    void missingConnectionDoesNotImport() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        when(service.listConnections()).thenReturn(List.of(connection(2L, "ACTIVE", null)));
        var scheduler = new AutomaticImportScheduler(service, props(true, "/migrator"), clock);

        scheduler.runDueImport();

        verify(service, never()).runImport(any(), any());
    }

    @Test
    void nonActiveConnectionDoesNotImport() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        when(service.listConnections()).thenReturn(List.of(connection(1L, "ERROR", null)));
        var scheduler = new AutomaticImportScheduler(service, props(true, "/migrator"), clock);

        scheduler.runDueImport();

        verify(service, never()).runImport(any(), any());
    }

    @Test
    void nullLastImportTriggersImportWithConfiguredArgs() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        when(service.listConnections()).thenReturn(List.of(connection(1L, "ACTIVE", null)));
        var scheduler = new AutomaticImportScheduler(service, props(true, "/migrator"), clock);

        scheduler.runDueImport();

        ArgumentCaptor<RunProviderImportRequest> captor = ArgumentCaptor.forClass(RunProviderImportRequest.class);
        verify(service, times(1)).runImport(eq(1L), captor.capture());
        RunProviderImportRequest req = captor.getValue();
        org.assertj.core.api.Assertions.assertThat(req.migratorPath()).isEqualTo("/migrator");
        org.assertj.core.api.Assertions.assertThat(req.bridgePath()).isEqualTo("/bridge");
        org.assertj.core.api.Assertions.assertThat(req.profile()).isEqualTo("full");
        org.assertj.core.api.Assertions.assertThat(req.target()).isEqualTo("codex,claude");
        org.assertj.core.api.Assertions.assertThat(req.includeSensitive()).isFalse();
    }

    @Test
    void recentImportIsSkipped() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        Instant recent = now.minus(5, ChronoUnit.HOURS);
        when(service.listConnections()).thenReturn(List.of(connection(1L, "ACTIVE", recent)));
        var scheduler = new AutomaticImportScheduler(service, props(true, "/migrator"), clock);

        scheduler.runDueImport();

        verify(service, never()).runImport(any(), any());
    }

    @Test
    void staleImportTriggers() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        Instant stale = now.minus(21, ChronoUnit.HOURS);
        when(service.listConnections()).thenReturn(List.of(connection(1L, "ACTIVE", stale)));
        var scheduler = new AutomaticImportScheduler(service, props(true, "/migrator"), clock);

        scheduler.runDueImport();

        verify(service, times(1)).runImport(eq(1L), any());
    }

    @Test
    void doesNotRetryWithinThresholdAfterAnAttempt() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        Instant stale = now.minus(21, ChronoUnit.HOURS);
        when(service.listConnections()).thenReturn(List.of(connection(1L, "ACTIVE", stale)));
        var scheduler = new AutomaticImportScheduler(service, props(true, "/migrator"), clock);

        scheduler.runDueImport();
        scheduler.runDueImport();

        verify(service, times(1)).runImport(eq(1L), any());
    }

    @Test
    void runImportFailureDoesNotPropagate() {
        ProviderConnectionService service = Mockito.mock(ProviderConnectionService.class);
        when(service.listConnections()).thenReturn(List.of(connection(1L, "ACTIVE", null)));
        when(service.runImport(eq(1L), any())).thenThrow(new RuntimeException("bridge boom"));
        var scheduler = new AutomaticImportScheduler(service, props(true, "/migrator"), clock);

        assertThatCode(scheduler::runDueImport).doesNotThrowAnyException();
        verify(service, times(1)).runImport(eq(1L), any());
    }
}
