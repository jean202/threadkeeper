package com.jean325.threadkeeper.notification.dto;

import com.jean325.threadkeeper.notification.domain.NotificationChannel;
import jakarta.validation.constraints.Size;

/**
 * Partial update of a notification rule. Every field is optional and a null field leaves the
 * stored value untouched, so the settings screen can toggle {@code enabled} without resending
 * the threshold or schedule.
 *
 * <p>{@code ruleType} is deliberately absent: rule semantics (and the meaning of
 * thresholdMinutes vs scheduledTime) are tied to the type, so a rule of the wrong type should be
 * created fresh rather than mutated into one.
 */
public record UpdateNotificationRuleRequest(
        Boolean enabled,
        NotificationChannel channel,
        Integer thresholdMinutes,
        @Size(max = 10) String scheduledTime,
        String configJson
) {
}
