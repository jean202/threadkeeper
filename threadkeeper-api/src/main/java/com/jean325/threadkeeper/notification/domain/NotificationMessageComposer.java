package com.jean325.threadkeeper.notification.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jean325.threadkeeper.thread.domain.Thread;
import java.time.Duration;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Turns a queued notification into the text a human reads.
 *
 * <p>What each kind has to say comes from docs/03-mvp-screens-and-features.md
 * section 5: a completion carries the summary, timestamp and a follow-up; an
 * inactivity reminder carries the original intent and last next action; a
 * briefing names the thread to resume; a drift warning contrasts the current
 * focus with the original goal.
 *
 * <p>Live thread fields are read at dispatch time, which is the state the
 * reader will find when they click through. Facts that only existed when the
 * event was queued -- how long the thread had been idle, which handoff became
 * ready -- come from the stored payload instead, since they cannot be
 * recovered later.
 */
@Component
public class NotificationMessageComposer {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter TIMESTAMP =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(SEOUL);

    /** Discord rejects a message body over 2000 characters. */
    private static final int MAX_MESSAGE_CHARS = 1900;
    /** Intents and next actions are stored up to 4000 chars; a reminder is not the place for all of it. */
    private static final int MAX_FIELD_CHARS = 300;

    private final ObjectMapper objectMapper;

    public NotificationMessageComposer(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String compose(NotificationEvent event) {
        Thread thread = event.getThread();
        if (thread == null) {
            // Nothing to describe beyond the event itself; better than a blank message.
            return "**" + event.getEventType().name() + "** (no thread attached)";
        }

        JsonNode payload = readPayload(event.getPayloadJson());
        List<String> lines = new ArrayList<>();

        switch (event.getEventType()) {
            case COMPLETION -> composeCompletion(thread, lines);
            case INACTIVITY -> composeInactivity(thread, payload, lines);
            case DAILY_BRIEFING -> composeBriefing(thread, lines);
            case DRIFT_ALERT -> composeDriftOrHandoff(thread, payload, lines);
        }

        return truncate(String.join("\n", lines), MAX_MESSAGE_CHARS);
    }

    private void composeCompletion(Thread thread, List<String> lines) {
        lines.add("✅ **Completed — " + oneLine(thread.getTitle()) + "**");
        lines.add(context(thread) + " · " + completedAt(thread));
        lines.add("");
        lines.add("Intent: " + field(thread.getOriginalIntent()));
        if (thread.getDoneCondition() != null && !thread.getDoneCondition().isBlank()) {
            lines.add("Done when: " + field(thread.getDoneCondition()));
        }
        lines.add("");
        // The follow-up is grounded in what the thread still holds rather than invented.
        if (hasText(thread.getCurrentNextAction())) {
            lines.add("Follow-up: a next action is still pinned — \"" + field(thread.getCurrentNextAction())
                    + "\". Clear it, or open a new thread for what is left.");
        } else {
            lines.add("Follow-up: nothing is pinned. Confirm the done condition held before moving on.");
        }
    }

    private void composeInactivity(Thread thread, JsonNode payload, List<String> lines) {
        long idleMinutes = payload.path("inactiveMinutes").asLong(-1);
        String idle = idleMinutes < 0 ? "a while" : humanDuration(idleMinutes);
        lines.add("⏰ **Idle " + idle + " — " + oneLine(thread.getTitle()) + "**");
        lines.add(context(thread));
        lines.add("");
        lines.add("Intent: " + field(thread.getOriginalIntent()));
        lines.add("Next action: " + nextActionOrPrompt(thread));
    }

    private void composeBriefing(Thread thread, List<String> lines) {
        lines.add("☀️ **Resume — " + oneLine(thread.getTitle()) + "**");
        lines.add(context(thread) + " · " + thread.getPriority().name());
        lines.add("");
        lines.add("Intent: " + field(thread.getOriginalIntent()));
        lines.add("Next action: " + nextActionOrPrompt(thread));
    }

    /**
     * A ready handoff is queued under DRIFT_ALERT as well, so the payload -- not
     * the event type -- decides which of the two this is. Rendering a handoff
     * notice as a drift warning would tell the reader something untrue.
     */
    private void composeDriftOrHandoff(Thread thread, JsonNode payload, List<String> lines) {
        if (payload.path("handoffId").isNumber()) {
            lines.add("🔀 **Handoff ready — " + oneLine(thread.getTitle()) + "**");
            lines.add(context(thread));
            lines.add("");
            lines.add("Next action: " + nextActionOrPrompt(thread));
            return;
        }

        String score = thread.getDriftScore() == null
                ? ""
                : " " + thread.getDriftScore().stripTrailingZeros().toPlainString() + "% off intent";
        lines.add("⚠️ **Drifting" + score + " — " + oneLine(thread.getTitle()) + "**");
        lines.add(context(thread));
        lines.add("");
        lines.add("Original goal: " + field(thread.getOriginalIntent()));
        lines.add("Working on now: " + nextActionOrPrompt(thread));
    }

    private String context(Thread thread) {
        return "`" + thread.getProjectKey() + "`";
    }

    private String completedAt(Thread thread) {
        return thread.getCompletedAt() == null
                ? "completion time not recorded"
                : TIMESTAMP.format(thread.getCompletedAt()) + " KST";
    }

    private String nextActionOrPrompt(Thread thread) {
        return hasText(thread.getCurrentNextAction())
                ? field(thread.getCurrentNextAction())
                : "none pinned — decide one before resuming.";
    }

    /** Minutes as the largest unit that still reads naturally. */
    private String humanDuration(long minutes) {
        Duration duration = Duration.ofMinutes(minutes);
        if (minutes < 60) {
            return minutes + "m";
        }
        if (duration.toHours() < 24) {
            return duration.toHours() + "h";
        }
        return duration.toDays() + "d";
    }

    private JsonNode readPayload(String payloadJson) {
        try {
            return objectMapper.readTree(payloadJson == null || payloadJson.isBlank() ? "{}" : payloadJson);
        } catch (Exception ex) {
            // A malformed payload must not stop the notification going out; the
            // thread itself still carries most of what the message says.
            return objectMapper.createObjectNode();
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String field(String value) {
        return hasText(value) ? truncate(oneLine(value), MAX_FIELD_CHARS) : "—";
    }

    /** Newlines would break the one-fact-per-line layout. */
    private String oneLine(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }

    private String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }
}
