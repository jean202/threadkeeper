package com.jean325.threadkeeper.drift.api;

import com.jean325.threadkeeper.drift.application.DriftService;
import com.jean325.threadkeeper.drift.dto.DriftEvaluationResponse;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/threads/{threadId}/drift-evaluation")
public class DriftController {

    private final DriftService driftService;

    public DriftController(DriftService driftService) {
        this.driftService = driftService;
    }

    @PostMapping
    public DriftEvaluationResponse evaluate(@PathVariable Long threadId) {
        return driftService.evaluateThread(threadId);
    }
}
