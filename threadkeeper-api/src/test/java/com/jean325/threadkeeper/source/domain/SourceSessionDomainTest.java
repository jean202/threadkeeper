package com.jean325.threadkeeper.source.domain;

import com.jean325.threadkeeper.provider.domain.ProviderConnection;
import com.jean325.threadkeeper.provider.domain.ProviderType;
import com.jean325.threadkeeper.thread.domain.Thread;
import com.jean325.threadkeeper.thread.domain.ThreadPriority;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class SourceSessionDomainTest {

    @Test
    void constructorPopulatesStartedAndLastActivityFromArguments() {
        Thread thread = new Thread("k", "t", ThreadPriority.MEDIUM, "intent", null, "done");
        ProviderConnection conn = new ProviderConnection(ProviderType.CODEX, "label", null);
        Instant started = Instant.parse("2026-05-01T10:00:00Z");
        Instant last = Instant.parse("2026-05-01T10:30:00Z");

        SourceSession s = new SourceSession(thread, conn, "key", ProviderType.CODEX,
                "/path", "session", "title", "{}", started, last);

        assertThat(s.getStartedAt()).isEqualTo(started);
        assertThat(s.getLastActivityAt()).isEqualTo(last);
    }

    @Test
    void refreshFromImportUpdatesStartedAndLastActivity() {
        Thread thread = new Thread("k", "t", ThreadPriority.MEDIUM, "intent", null, "done");
        ProviderConnection conn = new ProviderConnection(ProviderType.CODEX, "label", null);
        SourceSession s = new SourceSession(thread, conn, "key", ProviderType.CODEX,
                "/path", "session", "title", "{}",
                Instant.parse("2026-05-01T10:00:00Z"),
                Instant.parse("2026-05-01T10:30:00Z"));

        Instant newLast = Instant.parse("2026-05-02T11:00:00Z");
        s.refreshFromImport("/new", "session", "newtitle", "{}",
                Instant.parse("2026-05-01T10:00:00Z"), newLast);

        assertThat(s.getLastActivityAt()).isEqualTo(newLast);
        assertThat(s.getSourcePath()).isEqualTo("/new");
        assertThat(s.getTitle()).isEqualTo("newtitle");
    }
}
