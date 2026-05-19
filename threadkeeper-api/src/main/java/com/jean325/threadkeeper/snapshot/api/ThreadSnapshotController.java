package com.jean325.threadkeeper.snapshot.api;

import com.jean325.threadkeeper.snapshot.application.ThreadSnapshotService;
import com.jean325.threadkeeper.snapshot.dto.CreateThreadSnapshotRequest;
import com.jean325.threadkeeper.snapshot.dto.ThreadSnapshotResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/threads/{threadId}/snapshots")
public class ThreadSnapshotController {

    private final ThreadSnapshotService threadSnapshotService;

    public ThreadSnapshotController(ThreadSnapshotService threadSnapshotService) {
        this.threadSnapshotService = threadSnapshotService;
    }

    @GetMapping
    public List<ThreadSnapshotResponse> listSnapshots(@PathVariable Long threadId) {
        return threadSnapshotService.listSnapshots(threadId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ThreadSnapshotResponse createSnapshot(
            @PathVariable Long threadId,
            @Valid @RequestBody CreateThreadSnapshotRequest request
    ) {
        return threadSnapshotService.createSnapshot(threadId, request);
    }
}
