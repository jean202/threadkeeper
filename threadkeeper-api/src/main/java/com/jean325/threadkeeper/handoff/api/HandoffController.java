package com.jean325.threadkeeper.handoff.api;

import com.jean325.threadkeeper.handoff.application.HandoffService;
import com.jean325.threadkeeper.handoff.dto.CreateHandoffRequest;
import com.jean325.threadkeeper.handoff.dto.GenerateHandoffDraftRequest;
import com.jean325.threadkeeper.handoff.dto.HandoffResponse;
import com.jean325.threadkeeper.handoff.dto.UpdateHandoffRequest;
import com.jean325.threadkeeper.handoff.dto.UpdateHandoffStatusRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HandoffController {

    private final HandoffService handoffService;

    public HandoffController(HandoffService handoffService) {
        this.handoffService = handoffService;
    }

    @GetMapping("/api/v1/threads/{threadId}/handoffs")
    public List<HandoffResponse> listHandoffs(@PathVariable Long threadId) {
        return handoffService.listHandoffs(threadId);
    }

    @PostMapping("/api/v1/threads/{threadId}/handoffs")
    @ResponseStatus(HttpStatus.CREATED)
    public HandoffResponse createHandoff(
            @PathVariable Long threadId,
            @Valid @RequestBody CreateHandoffRequest request
    ) {
        return handoffService.createHandoff(threadId, request);
    }

    @PostMapping("/api/v1/threads/{threadId}/handoffs/draft")
    @ResponseStatus(HttpStatus.CREATED)
    public HandoffResponse generateDraft(
            @PathVariable Long threadId,
            @Valid @RequestBody GenerateHandoffDraftRequest request
    ) {
        return handoffService.generateDraft(threadId, request);
    }

    @PatchMapping("/api/v1/handoffs/{handoffId}")
    public HandoffResponse updateHandoff(
            @PathVariable Long handoffId,
            @Valid @RequestBody UpdateHandoffRequest request
    ) {
        return handoffService.updateHandoff(handoffId, request);
    }

    @PatchMapping("/api/v1/handoffs/{handoffId}/status")
    public HandoffResponse updateStatus(
            @PathVariable Long handoffId,
            @Valid @RequestBody UpdateHandoffStatusRequest request
    ) {
        return handoffService.updateStatus(handoffId, request);
    }
}
