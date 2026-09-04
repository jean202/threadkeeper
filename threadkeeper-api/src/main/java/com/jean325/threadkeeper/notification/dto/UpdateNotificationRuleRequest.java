package com.jean325.threadkeeper.notification.dto;

import com.jean325.threadkeeper.notification.domain.NotificationChannel;
import jakarta.validation.constraints.Size;

/**
 * Edits an existing rule. The rule type is immutable and so is not accepted
 * here.
 *
 * <p>This is a partial update: every field is optional and a null one leaves
 * the stored value alone. That is what lets the settings screen flip
 * {@code enabled} without resending a threshold it never showed the user --
 * and it is why {@code enabled} is a {@code Boolean}, since a primitive would
 * silently read an omitted field as false and disable the rule.
 *
 * <p>The cost of those semantics is that a field cannot be cleared back to
 * null through this endpoint, since "absent" and "explicitly null" arrive
 * identically. Nothing needs to: a threshold only applies to INACTIVITY rules
 * and a schedule only to DAILY_BRIEFING, and the rule type cannot change.
 */
public record UpdateNotificationRuleRequest(
        Boolean enabled,
        NotificationChannel channel,
        Integer thresholdMinutes,
        @Size(max = 10) String scheduledTime,
        String configJson
) {
}
