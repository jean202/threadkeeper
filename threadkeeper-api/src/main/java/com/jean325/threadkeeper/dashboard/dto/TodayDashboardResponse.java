package com.jean325.threadkeeper.dashboard.dto;

import java.util.List;

public record TodayDashboardResponse(
        List<String> activeThreads,
        List<String> staleThreads,
        List<String> blockedThreads,
        List<String> completedToday,
        List<String> recommendedOrder
) {
}
