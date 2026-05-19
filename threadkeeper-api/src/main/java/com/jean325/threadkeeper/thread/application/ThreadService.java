package com.jean325.threadkeeper.thread.application;

import com.jean325.threadkeeper.global.error.ApiException;
import com.jean325.threadkeeper.handoff.domain.HandoffRepository;
import com.jean325.threadkeeper.handoff.dto.HandoffResponse;
import com.jean325.threadkeeper.notification.application.NotificationEventService;
import com.jean325.threadkeeper.notification.domain.NotificationEventRepository;
import com.jean325.threadkeeper.notification.domain.NotificationRuleType;
import com.jean325.threadkeeper.notification.dto.NotificationEventResponse;
import com.jean325.threadkeeper.snapshot.domain.ThreadSnapshotRepository;
import com.jean325.threadkeeper.snapshot.dto.ThreadSnapshotResponse;
import com.jean325.threadkeeper.source.domain.SourceSessionRepository;
import com.jean325.threadkeeper.source.dto.SourceSessionResponse;
import com.jean325.threadkeeper.thread.domain.Thread;
import com.jean325.threadkeeper.thread.domain.ThreadRepository;
import com.jean325.threadkeeper.thread.dto.CreateThreadRequest;
import com.jean325.threadkeeper.thread.dto.ThreadDetailResponse;
import com.jean325.threadkeeper.thread.dto.ThreadResponse;
import com.jean325.threadkeeper.thread.dto.UpdateNextActionRequest;
import com.jean325.threadkeeper.thread.dto.UpdateThreadStatusRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ThreadService {

    private final ThreadRepository threadRepository;
    private final SourceSessionRepository sourceSessionRepository;
    private final ThreadSnapshotRepository threadSnapshotRepository;
    private final HandoffRepository handoffRepository;
    private final NotificationEventRepository notificationEventRepository;
    private final NotificationEventService notificationEventService;

    public ThreadService(
            ThreadRepository threadRepository,
            SourceSessionRepository sourceSessionRepository,
            ThreadSnapshotRepository threadSnapshotRepository,
            HandoffRepository handoffRepository,
            NotificationEventRepository notificationEventRepository,
            NotificationEventService notificationEventService
    ) {
        this.threadRepository = threadRepository;
        this.sourceSessionRepository = sourceSessionRepository;
        this.threadSnapshotRepository = threadSnapshotRepository;
        this.handoffRepository = handoffRepository;
        this.notificationEventRepository = notificationEventRepository;
        this.notificationEventService = notificationEventService;
    }

    @Transactional(readOnly = true)
    public List<ThreadResponse> listThreads() {
        return threadRepository.findAllByOrderByLastActivityAtDesc()
                .stream()
                .map(ThreadResponse::from)
                .toList();
    }

    @Transactional
    public ThreadResponse createThread(CreateThreadRequest request) {
        Thread thread = new Thread(
                request.projectKey(),
                request.title(),
                request.priority(),
                request.originalIntent(),
                request.todayGoal(),
                request.doneCondition()
        );
        return ThreadResponse.from(threadRepository.save(thread));
    }

    @Transactional(readOnly = true)
    public ThreadDetailResponse getThread(Long threadId) {
        Thread thread = findThread(threadId);
        List<SourceSessionResponse> sourceSessions = sourceSessionRepository.findAllByThreadIdOrderByImportedAtDesc(threadId)
                .stream()
                .map(SourceSessionResponse::from)
                .toList();
        List<ThreadSnapshotResponse> snapshots = threadSnapshotRepository.findAllByThreadIdOrderByCreatedAtDesc(threadId)
                .stream()
                .map(ThreadSnapshotResponse::from)
                .toList();
        List<HandoffResponse> handoffs = handoffRepository.findAllByThreadIdOrderByCreatedAtDesc(threadId)
                .stream()
                .map(HandoffResponse::from)
                .toList();
        List<NotificationEventResponse> notificationEvents = notificationEventRepository.findAllByThreadIdOrderByCreatedAtDesc(threadId)
                .stream()
                .map(NotificationEventResponse::from)
                .toList();
        return ThreadDetailResponse.from(thread, sourceSessions, snapshots, handoffs, notificationEvents);
    }

    @Transactional
    public ThreadResponse updateStatus(Long threadId, UpdateThreadStatusRequest request) {
        Thread thread = findThread(threadId);
        thread.updateStatus(request.status());
        if (request.status().name().equals("COMPLETED")) {
            notificationEventService.queueForThread(
                    thread,
                    NotificationRuleType.COMPLETION,
                    "{\"message\":\"Thread completed\",\"threadId\":" + thread.getId() + "}"
            );
        }
        return ThreadResponse.from(thread);
    }

    @Transactional
    public ThreadResponse updateNextAction(Long threadId, UpdateNextActionRequest request) {
        Thread thread = findThread(threadId);
        thread.updateNextAction(request.currentNextAction());
        return ThreadResponse.from(thread);
    }

    private Thread findThread(Long threadId) {
        return threadRepository.findById(threadId)
                .orElseThrow(() -> new ApiException(
                        "THREAD_NOT_FOUND",
                        "The requested thread does not exist.",
                        HttpStatus.NOT_FOUND
                ));
    }
}
