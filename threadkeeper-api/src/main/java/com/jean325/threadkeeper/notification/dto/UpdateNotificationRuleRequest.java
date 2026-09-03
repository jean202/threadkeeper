package com.jean325.threadkeeper.notification.dto;

import com.jean325.threadkeeper.notification.domain.NotificationChannel;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Edits an existing rule. The rule type is immutable and so is not accepted here. */
public record UpdateNotificationRuleRequest(
        boolean enabled,
        @NotNull NotificationChannel channel,
        Integer thresholdMinutes,
        @Size(max = 10) String scheduledTime,
        String configJson
) {
}
