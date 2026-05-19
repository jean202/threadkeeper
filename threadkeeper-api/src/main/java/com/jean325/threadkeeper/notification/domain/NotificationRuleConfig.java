package com.jean325.threadkeeper.notification.domain;

import com.jean325.threadkeeper.thread.domain.DriftStatus;
import com.jean325.threadkeeper.thread.domain.ThreadPriority;
import java.util.List;
import java.util.Set;

public record NotificationRuleConfig(
        Set<String> projectKeys,
        Set<String> excludeProjectKeys,
        ThreadPriority minimumPriority,
        Integer cooldownMinutes,
        Integer topN,
        Integer staleMinutes,
        boolean onlyIfMissingNextAction,
        List<DriftStatus> driftStatuses
) {
    public static NotificationRuleConfig empty() {
        return new NotificationRuleConfig(Set.of(), Set.of(), null, null, null, null, false, List.of());
    }
}
