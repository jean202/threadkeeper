package com.jean325.threadkeeper.snapshot.application;

import com.jean325.threadkeeper.global.error.ApiException;
import com.jean325.threadkeeper.snapshot.domain.ThreadSnapshot;
import com.jean325.threadkeeper.snapshot.domain.ThreadSnapshotRepository;
import com.jean325.threadkeeper.snapshot.dto.CreateThreadSnapshotRequest;
import com.jean325.threadkeeper.snapshot.dto.ThreadSnapshotResponse;
import com.jean325.threadkeeper.thread.domain.Thread;
import com.jean325.threadkeeper.thread.domain.ThreadRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class ThreadSnapshotService {

    private final ThreadSnapshotRepository threadSnapshotRepository;
    private final ThreadRepository threadRepository;

    public ThreadSnapshotService(ThreadSnapshotRepository threadSnapshotRepository, ThreadRepository threadRepository) {
        this.threadSnapshotRepository = threadSnapshotRepository;
        this.threadRepository = threadRepository;
    }

    @Transactional(readOnly = true)
    public List<ThreadSnapshotResponse> listSnapshots(Long threadId) {
        return threadSnapshotRepository.findAllByThreadIdOrderByCreatedAtDesc(threadId)
                .stream()
                .map(ThreadSnapshotResponse::from)
                .toList();
    }

    @Transactional
    public ThreadSnapshotResponse createSnapshot(Long threadId, CreateThreadSnapshotRequest request) {
        Thread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new ApiException("THREAD_NOT_FOUND", "The requested thread does not exist.", HttpStatus.NOT_FOUND));
        ThreadSnapshot snapshot = new ThreadSnapshot(
                thread,
                request.snapshotType(),
                request.summary(),
                request.nextAction(),
                request.blockers(),
                request.driftScore(),
                request.driftStatus()
        );
        return ThreadSnapshotResponse.from(threadSnapshotRepository.save(snapshot));
    }
}
