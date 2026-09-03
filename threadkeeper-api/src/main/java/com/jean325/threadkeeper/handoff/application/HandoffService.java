package com.jean325.threadkeeper.handoff.application;

import com.jean325.threadkeeper.global.error.ApiException;
import com.jean325.threadkeeper.handoff.domain.Handoff;
import com.jean325.threadkeeper.handoff.domain.HandoffRepository;
import com.jean325.threadkeeper.handoff.domain.HandoffStatus;
import com.jean325.threadkeeper.handoff.dto.CreateHandoffRequest;
import com.jean325.threadkeeper.handoff.dto.GenerateHandoffDraftRequest;
import com.jean325.threadkeeper.handoff.dto.HandoffResponse;
import com.jean325.threadkeeper.handoff.dto.UpdateHandoffRequest;
import com.jean325.threadkeeper.handoff.dto.UpdateHandoffStatusRequest;
import com.jean325.threadkeeper.notification.application.NotificationEventService;
import com.jean325.threadkeeper.notification.domain.NotificationRuleType;
import com.jean325.threadkeeper.snapshot.domain.ThreadSnapshot;
import com.jean325.threadkeeper.snapshot.domain.ThreadSnapshotRepository;
import com.jean325.threadkeeper.source.domain.SourceSession;
import com.jean325.threadkeeper.source.domain.SourceSessionRepository;
import com.jean325.threadkeeper.thread.domain.Thread;
import com.jean325.threadkeeper.thread.domain.ThreadRepository;
import java.util.Optional;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HandoffService {

    private final HandoffRepository handoffRepository;
    private final ThreadRepository threadRepository;
    private final SourceSessionRepository sourceSessionRepository;
    private final ThreadSnapshotRepository threadSnapshotRepository;
    private final NotificationEventService notificationEventService;

    public HandoffService(
            HandoffRepository handoffRepository,
            ThreadRepository threadRepository,
            SourceSessionRepository sourceSessionRepository,
            ThreadSnapshotRepository threadSnapshotRepository,
            NotificationEventService notificationEventService
    ) {
        this.handoffRepository = handoffRepository;
        this.threadRepository = threadRepository;
        this.sourceSessionRepository = sourceSessionRepository;
        this.threadSnapshotRepository = threadSnapshotRepository;
        this.notificationEventService = notificationEventService;
    }

    @Transactional(readOnly = true)
    public List<HandoffResponse> listHandoffs(Long threadId) {
        return handoffRepository.findAllByThreadIdOrderByCreatedAtDesc(threadId).stream()
                .map(HandoffResponse::from)
                .toList();
    }

    @Transactional
    public HandoffResponse createHandoff(Long threadId, CreateHandoffRequest request) {
        Thread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new ApiException("THREAD_NOT_FOUND", "The requested thread does not exist.", HttpStatus.NOT_FOUND));
        SourceSession sourceSession = resolveSourceSession(thread, request.sourceSessionId());

        Handoff handoff = handoffRepository.save(new Handoff(
                thread,
                sourceSession,
                request.targetProvider(),
                request.reason(),
                request.whatChanged(),
                request.blockers(),
                request.nextAction(),
                request.filesNote(),
                request.status() == null ? HandoffStatus.DRAFT : request.status()
        ));

        if (handoff.getStatus() == HandoffStatus.READY) {
            notificationEventService.queueForThread(
                    thread,
                    NotificationRuleType.DRIFT_ALERT,
                    "{\"message\":\"Handoff ready\",\"handoffId\":" + handoff.getId() + "}"
            );
        }

        return HandoffResponse.from(handoff);
    }

    @Transactional
    public HandoffResponse generateDraft(Long threadId, GenerateHandoffDraftRequest request) {
        Thread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new ApiException("THREAD_NOT_FOUND", "The requested thread does not exist.", HttpStatus.NOT_FOUND));
        SourceSession sourceSession = request.sourceSessionId() == null
                ? sourceSessionRepository.findFirstByThreadIdOrderByImportedAtDesc(threadId).orElse(null)
                : resolveSourceSession(thread, request.sourceSessionId());
        Optional<ThreadSnapshot> latestSnapshot = threadSnapshotRepository.findFirstByThreadIdOrderByCreatedAtDesc(threadId);

        Handoff handoff = new Handoff(
                thread,
                sourceSession,
                request.targetProvider(),
                buildReason(request),
                buildWhatChanged(thread, latestSnapshot, sourceSession),
                buildBlockers(latestSnapshot),
                buildNextAction(thread, latestSnapshot),
                buildFilesNote(sourceSession),
                HandoffStatus.DRAFT
        );
        return HandoffResponse.from(handoffRepository.save(handoff));
    }

    @Transactional
    public HandoffResponse updateHandoff(Long handoffId, UpdateHandoffRequest request) {
        Handoff handoff = handoffRepository.findById(handoffId)
                .orElseThrow(() -> new ApiException("HANDOFF_NOT_FOUND", "The requested handoff does not exist.", HttpStatus.NOT_FOUND));
        handoff.updateContent(
                request.targetProvider(),
                request.reason(),
                request.whatChanged(),
                request.blockers(),
                request.nextAction(),
                request.filesNote()
        );
        if (request.status() != null) {
            handoff.updateStatus(request.status());
        }
        return HandoffResponse.from(handoff);
    }

    @Transactional
    public HandoffResponse updateStatus(Long handoffId, UpdateHandoffStatusRequest request) {
        Handoff handoff = handoffRepository.findById(handoffId)
                .orElseThrow(() -> new ApiException("HANDOFF_NOT_FOUND", "The requested handoff does not exist.", HttpStatus.NOT_FOUND));
        handoff.updateStatus(request.status());
        return HandoffResponse.from(handoff);
    }

    private SourceSession resolveSourceSession(Thread thread, Long sourceSessionId) {
        if (sourceSessionId == null) {
            return null;
        }
        SourceSession sourceSession = sourceSessionRepository.findById(sourceSessionId)
                .orElseThrow(() -> new ApiException("SOURCE_SESSION_NOT_FOUND", "The requested source session does not exist.", HttpStatus.NOT_FOUND));
        if (sourceSession.getThread() == null || !sourceSession.getThread().getId().equals(thread.getId())) {
            throw new ApiException("SOURCE_SESSION_THREAD_MISMATCH", "The source session does not belong to the requested thread.", HttpStatus.BAD_REQUEST);
        }
        return sourceSession;
    }

    private String buildReason(GenerateHandoffDraftRequest request) {
        if (request.reasonHint() != null && !request.reasonHint().isBlank()) {
            return request.reasonHint();
        }
        return "Continue this thread in " + request.targetProvider().name();
    }

    private String buildWhatChanged(Thread thread, Optional<ThreadSnapshot> latestSnapshot, SourceSession sourceSession) {
        StringBuilder builder = new StringBuilder();
        builder.append("Original intent: ").append(thread.getOriginalIntent());
        if (latestSnapshot.isPresent()) {
            builder.append("\nLatest snapshot: ").append(latestSnapshot.get().getSummary());
        }
        if (sourceSession != null) {
            builder.append("\nLatest source session: ")
                    .append(sourceSession.getProvider().name())
                    .append(" / ")
                    .append(sourceSession.getTitle() == null || sourceSession.getTitle().isBlank() ? sourceSession.getProviderSessionKey() : sourceSession.getTitle());
        }
        return builder.toString();
    }

    private String buildBlockers(Optional<ThreadSnapshot> latestSnapshot) {
        return latestSnapshot.map(ThreadSnapshot::getBlockers)
                .filter(blockers -> blockers != null && !blockers.isBlank())
                .orElse("No blockers captured yet.");
    }

    private String buildNextAction(Thread thread, Optional<ThreadSnapshot> latestSnapshot) {
        return latestSnapshot.map(ThreadSnapshot::getNextAction)
                .filter(nextAction -> nextAction != null && !nextAction.isBlank())
                .orElseGet(() -> {
                    if (thread.getCurrentNextAction() != null && !thread.getCurrentNextAction().isBlank()) {
                        return thread.getCurrentNextAction();
                    }
                    if (thread.getTodayGoal() != null && !thread.getTodayGoal().isBlank()) {
                        return thread.getTodayGoal();
                    }
                    return "Review the latest thread context and choose the next concrete action.";
                });
    }

    private String buildFilesNote(SourceSession sourceSession) {
        if (sourceSession == null) {
            return "No source session linked yet.";
        }
        if (sourceSession.getSourcePath() == null || sourceSession.getSourcePath().isBlank()) {
            return "Source type: " + sourceSession.getSourceType();
        }
        return "Source type: " + sourceSession.getSourceType() + "\nPath: " + sourceSession.getSourcePath();
    }
}
