package com.jean325.threadkeeper.notification.dto;

import com.jean325.threadkeeper.notification.domain.NotificationChannel;
import com.jean325.threadkeeper.notification.domain.NotificationRuleType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateNotificationRuleRequest(
        @NotNull NotificationRuleType ruleType,
        boolean enabled,
        @NotNull NotificationChannel channel,
        Integer thresholdMinutes,
        @Size(max = 10) String scheduledTime,
        String configJson
) {
}
