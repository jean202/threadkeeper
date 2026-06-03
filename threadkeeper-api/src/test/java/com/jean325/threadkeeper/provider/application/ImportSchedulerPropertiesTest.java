package com.jean325.threadkeeper.provider.application;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ImportSchedulerPropertiesTest {

    @Test
    void hasSafeDefaults() {
        ImportSchedulerProperties p = new ImportSchedulerProperties();
        assertThat(p.isEnabled()).isFalse();
        assertThat(p.getConnectionId()).isEqualTo(1L);
        assertThat(p.getTarget()).isEqualTo("codex,claude");
        assertThat(p.getProfile()).isEqualTo("full");
        assertThat(p.isIncludeSensitive()).isFalse();
        assertThat(p.getCheckDelayMs()).isEqualTo(3_600_000L);
        assertThat(p.getStalenessThresholdHours()).isEqualTo(20L);
    }
}
