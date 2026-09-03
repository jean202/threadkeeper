package com.jean325.threadkeeper.dashboard.dto;

import java.util.List;

public record TodayDashboardResponse(
        List<DashboardThread> activeThreads,
        List<DashboardThread> staleThreads,
        List<DashboardThread> blockedThreads,
        List<DashboardThread> completedToday,
        List<DashboardThread> recommendedOrder
) {
}
