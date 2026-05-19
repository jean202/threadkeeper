package com.jean325.threadkeeper.dashboard.api;

import com.jean325.threadkeeper.dashboard.application.DashboardService;
import com.jean325.threadkeeper.dashboard.dto.BriefingResponse;
import com.jean325.threadkeeper.dashboard.dto.TodayDashboardResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/today")
    public TodayDashboardResponse today() {
        return dashboardService.today();
    }

    @GetMapping("/briefing")
    public BriefingResponse briefing() {
        return dashboardService.briefing();
    }
}
