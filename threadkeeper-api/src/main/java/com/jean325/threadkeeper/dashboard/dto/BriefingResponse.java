package com.jean325.threadkeeper.dashboard.dto;

import java.util.List;

public record BriefingResponse(
        String headline,
        List<DashboardThread> threads
) {
}
