package com.jean325.threadkeeper.notification.dto;

import com.jean325.threadkeeper.notification.domain.NotificationRule;

public record NotificationRuleResponse(
        Long id,
        String ruleType,
        boolean enabled,
        String channel,
        Integer thresholdMinutes,
        String scheduledTime,
        String configJson
) {
    public static NotificationRuleResponse from(NotificationRule rule) {
        return new NotificationRuleResponse(
                rule.getId(),
                rule.getRuleType().name(),
                rule.isEnabled(),
                rule.getChannel().name(),
                rule.getThresholdMinutes(),
                rule.getScheduledTime(),
                rule.getConfigJson()
        );
    }
}
