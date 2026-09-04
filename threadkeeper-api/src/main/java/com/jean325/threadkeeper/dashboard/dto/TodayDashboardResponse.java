package com.jean325.threadkeeper.dashboard.dto;

import java.util.List;

/**
 * The Today screen's four buckets plus the order to resume them in.
 *
 * <p>{@code recommendedOrder} carries thread ids rather than the threads
 * themselves: every id in it appears in {@code activeThreads}, so repeating the
 * objects would send each active thread down the wire twice.
 */
public record TodayDashboardResponse(
        List<DashboardThread> activeThreads,
        List<DashboardThread> staleThreads,
        List<DashboardThread> blockedThreads,
        List<DashboardThread> completedToday,
        List<Long> recommendedOrder
) {
}
