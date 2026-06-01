package com.jean325.threadkeeper.thread.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class ThreadApplyImportedSessionTest {

    @Test
    void applyImportedSessionOverwritesIntentNextActionAndLastActivity() {
        Thread thread = new Thread(
                "imported-codex", "placeholder title", ThreadPriority.MEDIUM,
                "Imported from CODEX session.",   // placeholder original intent
                "Review imported context.",        // placeholder todayGoal
                "Thread is classified."
        );
        Instant when = Instant.parse("2026-05-02T15:00:00Z");

        thread.applyImportedSession("Real first user prompt", "Last agent statement", when);

        assertThat(thread.getOriginalIntent()).isEqualTo("Real first user prompt");
        assertThat(thread.getCurrentNextAction()).isEqualTo("Last agent statement");
        assertThat(thread.getLastActivityAt()).isEqualTo(when);
    }

    @Test
    void applyImportedSessionKeepsExistingValueWhenArgumentIsNull() {
        Thread thread = new Thread("k", "t", ThreadPriority.MEDIUM, "intent", "todayGoal", "done");
        Instant before = thread.getLastActivityAt();

        thread.applyImportedSession(null, null, null);

        assertThat(thread.getOriginalIntent()).isEqualTo("intent");
        assertThat(thread.getCurrentNextAction()).isEqualTo("todayGoal");
        assertThat(thread.getLastActivityAt()).isEqualTo(before);
    }
}
