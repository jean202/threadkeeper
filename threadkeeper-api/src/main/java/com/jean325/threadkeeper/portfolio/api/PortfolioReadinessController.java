package com.jean325.threadkeeper.portfolio.api;

import com.jean325.threadkeeper.portfolio.application.PortfolioReadinessService;
import com.jean325.threadkeeper.portfolio.dto.PortfolioReadinessResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/portfolio-readiness")
public class PortfolioReadinessController {

    private final PortfolioReadinessService service;

    public PortfolioReadinessController(PortfolioReadinessService service) {
        this.service = service;
    }

    @GetMapping
    public List<PortfolioReadinessResponse> listReadiness() {
        return service.listReadiness();
    }
}
