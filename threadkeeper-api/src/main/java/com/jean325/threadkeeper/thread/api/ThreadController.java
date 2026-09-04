package com.jean325.threadkeeper.thread.api;

import com.jean325.threadkeeper.thread.application.ThreadService;
import com.jean325.threadkeeper.thread.dto.CreateThreadRequest;
import com.jean325.threadkeeper.thread.dto.ThreadDetailResponse;
import com.jean325.threadkeeper.provider.domain.ProviderType;
import com.jean325.threadkeeper.thread.domain.ThreadPriority;
import com.jean325.threadkeeper.thread.domain.ThreadStatus;
import com.jean325.threadkeeper.thread.dto.ThreadResponse;
import com.jean325.threadkeeper.thread.dto.ThreadSearchCriteria;
import com.jean325.threadkeeper.thread.dto.UpdateNextActionRequest;
import com.jean325.threadkeeper.thread.dto.UpdateThreadStatusRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/threads")
public class ThreadController {

    private final ThreadService threadService;

    public ThreadController(ThreadService threadService) {
        this.threadService = threadService;
    }

    /**
     * Lists threads, optionally filtered. Every parameter is optional and
     * omitting all of them returns the full list, so existing callers are
     * unaffected.
     */
    @GetMapping
    public List<ThreadResponse> listThreads(
            @RequestParam(required = false) String projectKey,
            @RequestParam(required = false) ProviderType provider,
            @RequestParam(required = false) ThreadStatus status,
            @RequestParam(required = false) ThreadPriority priority,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer activeWithinDays
    ) {
        return threadService.listThreads(
                new ThreadSearchCriteria(projectKey, provider, status, priority, q, activeWithinDays));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ThreadResponse createThread(@Valid @RequestBody CreateThreadRequest request) {
        return threadService.createThread(request);
    }

    @GetMapping("/{threadId}")
    public ThreadDetailResponse getThread(@PathVariable Long threadId) {
        return threadService.getThread(threadId);
    }

    @PatchMapping("/{threadId}/status")
    public ThreadResponse updateStatus(
            @PathVariable Long threadId,
            @Valid @RequestBody UpdateThreadStatusRequest request
    ) {
        return threadService.updateStatus(threadId, request);
    }

    @PatchMapping("/{threadId}/next-action")
    public ThreadResponse updateNextAction(
            @PathVariable Long threadId,
            @Valid @RequestBody UpdateNextActionRequest request
    ) {
        return threadService.updateNextAction(threadId, request);
    }
}
