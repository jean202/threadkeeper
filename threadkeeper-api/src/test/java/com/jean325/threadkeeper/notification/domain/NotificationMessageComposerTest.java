package com.jean325.threadkeeper.notification.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jean325.threadkeeper.thread.domain.Thread;
import com.jean325.threadkeeper.thread.domain.ThreadPriority;
import com.jean325.threadkeeper.thread.domain.ThreadStatus;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * What each message has to carry comes from
 * docs/03-mvp-screens-and-features.md section 5.
 */
class NotificationMessageComposerTest {

    private final NotificationMessageComposer composer =
            new NotificationMessageComposer(new ObjectMapper());

    private Thread thread() {
        Thread thread = new Thread(
                "threadkeeper",
                "Fix drift scoring",
                ThreadPriority.HIGH,
                "Make drift detection use intent-term coverage",
                "Ship the evaluator",
                "Tests green"
        );
        ReflectionTestUtils.setField(thread, "id", 1L);
        return thread;
    }

    private NotificationEvent event(Thread thread, NotificationRuleType type, String payload) {
        return new NotificationEvent(
                thread, null, type, NotificationChannel.DISCORD, payload,
                NotificationDeliveryStatus.QUEUED);
    }

    // "message: original intent + last next action"
    @Test
    void anInactivityReminderCarriesTheIntentAndTheNextAction() {
        String message = composer.compose(event(thread(), NotificationRuleType.INACTIVITY,
                "{\"message\":\"Thread inactive\",\"threadId\":1,\"inactiveMinutes\":185}"));

        assertThat(message).contains("Fix drift scoring");
        assertThat(message).contains("Make drift detection use intent-term coverage");
        assertThat(message).contains("Ship the evaluator");
        assertThat(message).contains("threadkeeper");
    }

    @Test
    void theIdleTimeReadsInTheLargestNaturalUnit() {
        assertThat(compose(NotificationRuleType.INACTIVITY, "{\"inactiveMinutes\":45}")).contains("Idle 45m");
        assertThat(compose(NotificationRuleType.INACTIVITY, "{\"inactiveMinutes\":185}")).contains("Idle 3h");
        assertThat(compose(NotificationRuleType.INACTIVITY, "{\"inactiveMinutes\":4321}")).contains("Idle 3d");
    }

    /** How long it had been idle only existed when the event was queued. */
    @Test
    void aMissingIdleTimeDoesNotProduceANonsenseDuration() {
        String message = compose(NotificationRuleType.INACTIVITY, "{}");

        assertThat(message).doesNotContain("-1");
        assertThat(message).contains("Idle a while");
    }

    // "message: summary + completion timestamp + follow-up recommendation"
    @Test
    void aCompletionCarriesTheTimestampAndAFollowUp() {
        Thread thread = thread();
        thread.updateStatus(ThreadStatus.COMPLETED);
        ReflectionTestUtils.setField(thread, "completedAt", Instant.parse("2026-09-04T05:32:00Z"));

        String message = composer.compose(event(thread, NotificationRuleType.COMPLETION, "{}"));

        assertThat(message).contains("Completed");
        assertThat(message).contains("Fix drift scoring");
        // Rendered in the same zone the rest of the app reports in.
        assertThat(message).contains("2026-09-04 14:32 KST");
        assertThat(message).contains("Tests green");
        assertThat(message).contains("Follow-up:");
    }

    @Test
    void theFollowUpFlagsAStillPinnedNextActionRatherThanInventingOne() {
        Thread thread = thread();
        thread.updateStatus(ThreadStatus.COMPLETED);

        String message = composer.compose(event(thread, NotificationRuleType.COMPLETION, "{}"));

        assertThat(message).contains("still pinned");
        assertThat(message).contains("Ship the evaluator");
    }

    @Test
    void aCompletionWithNothingPinnedPointsAtTheDoneCondition() {
        Thread thread = thread();
        ReflectionTestUtils.setField(thread, "currentNextAction", null);
        thread.updateStatus(ThreadStatus.COMPLETED);

        String message = composer.compose(event(thread, NotificationRuleType.COMPLETION, "{}"));

        assertThat(message).contains("nothing is pinned");
        assertThat(message).contains("done condition");
    }

    // "message: current focus differs from original goal"
    @Test
    void aDriftWarningContrastsTheOriginalGoalWithTheCurrentFocus() {
        Thread thread = thread();
        ReflectionTestUtils.setField(thread, "driftScore", new BigDecimal("80.00"));
        ReflectionTestUtils.setField(thread, "currentNextAction", "Refactor the HTTP client");

        String message = composer.compose(event(thread, NotificationRuleType.DRIFT_ALERT,
                "{\"message\":\"Thread drift detected\",\"threadId\":1,\"driftStatus\":\"DRIFTING\"}"));

        assertThat(message).contains("Drifting 80% off intent");
        assertThat(message).contains("Original goal: Make drift detection use intent-term coverage");
        assertThat(message).contains("Working on now: Refactor the HTTP client");
    }

    /**
     * A ready handoff is queued under DRIFT_ALERT too. Announcing it as drift
     * would tell the reader something untrue about their thread.
     */
    @Test
    void aReadyHandoffIsNotAnnouncedAsDrift() {
        String message = composer.compose(event(thread(), NotificationRuleType.DRIFT_ALERT,
                "{\"message\":\"Handoff ready\",\"handoffId\":7}"));

        assertThat(message).contains("Handoff ready");
        assertThat(message).doesNotContain("Drifting");
        assertThat(message).doesNotContain("off intent");
    }

    // "message: top three threads to resume"
    @Test
    void aBriefingNamesTheThreadAndWhatToDoNext() {
        String message = compose(NotificationRuleType.DAILY_BRIEFING, "{\"message\":\"Daily briefing\"}");

        assertThat(message).contains("Resume");
        assertThat(message).contains("Fix drift scoring");
        assertThat(message).contains("HIGH");
        assertThat(message).contains("Ship the evaluator");
    }

    @Test
    void aThreadWithNoNextActionSaysSoInsteadOfLeavingItBlank() {
        Thread thread = thread();
        ReflectionTestUtils.setField(thread, "currentNextAction", null);

        String message = composer.compose(event(thread, NotificationRuleType.INACTIVITY, "{}"));

        assertThat(message).contains("none pinned");
        assertThat(message).doesNotContain("null");
    }

    /** Discord rejects a body over 2000 characters, and intents are stored up to 4000. */
    @Test
    void aVeryLongIntentCannotPushTheMessagePastTheDiscordLimit() {
        Thread thread = new Thread(
                "threadkeeper", "Long one", ThreadPriority.LOW,
                "x".repeat(4000), "y".repeat(4000), "z".repeat(4000));

        String message = composer.compose(event(thread, NotificationRuleType.INACTIVITY, "{}"));

        assertThat(message.length()).isLessThanOrEqualTo(2000);
        assertThat(message).contains("Long one");
    }

    /** Newlines in an intent would break the one-fact-per-line layout. */
    @Test
    void newlinesInStoredTextAreFlattened() {
        Thread thread = new Thread(
                "threadkeeper", "Multi", ThreadPriority.LOW,
                "first line\nsecond line", "do\nthis", "done");

        String message = composer.compose(event(thread, NotificationRuleType.INACTIVITY, "{}"));

        assertThat(message).contains("Intent: first line second line");
        assertThat(message).contains("Next action: do this");
    }

    /** A bad payload must not stop the notification going out. */
    @Test
    void aMalformedPayloadStillProducesAMessage() {
        String message = compose(NotificationRuleType.INACTIVITY, "not json at all");

        assertThat(message).contains("Fix drift scoring");
        assertThat(message).contains("Make drift detection use intent-term coverage");
    }

    @Test
    void anEventWithNoThreadDoesNotCrash() {
        String message = composer.compose(event(null, NotificationRuleType.COMPLETION, "{}"));

        assertThat(message).contains("COMPLETION");
    }

    /** The old renderer sent the raw payload JSON; nothing should now. */
    @Test
    void theRawPayloadIsNeverShownToTheReader() {
        String message = compose(NotificationRuleType.INACTIVITY,
                "{\"message\":\"Thread inactive\",\"threadId\":1,\"inactiveMinutes\":185}");

        assertThat(message).doesNotContain("payload=");
        assertThat(message).doesNotContain("inactiveMinutes");
        assertThat(message).doesNotContain("threadId");
    }

    private String compose(NotificationRuleType type, String payload) {
        return composer.compose(event(thread(), type, payload));
    }
}
