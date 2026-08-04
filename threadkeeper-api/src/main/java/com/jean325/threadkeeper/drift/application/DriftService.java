package com.jean325.threadkeeper.drift.application;

import com.jean325.threadkeeper.drift.domain.DriftEvaluation;
import com.jean325.threadkeeper.drift.domain.DriftEvaluator;
import com.jean325.threadkeeper.drift.domain.DriftProperties;
import com.jean325.threadkeeper.drift.dto.DriftEvaluationResponse;
import com.jean325.threadkeeper.global.error.ApiException;
import com.jean325.threadkeeper.snapshot.domain.ThreadSnapshot;
import com.jean325.threadkeeper.snapshot.domain.ThreadSnapshotRepository;
import com.jean325.threadkeeper.source.domain.SourceSession;
import com.jean325.threadkeeper.source.domain.SourceSessionRepository;
import com.jean325.threadkeeper.thread.domain.Thread;
import com.jean325.threadkeeper.thread.domain.ThreadRepository;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Keeps each thread's drift status current: compares the immutable original
 * intent against what the thread has recently been doing, and stores the result.
 */
@Service
public class DriftService {

    private final ThreadRepository threadRepository;
    private final ThreadSnapshotRepository threadSnapshotRepository;
    private final SourceSessionRepository sourceSessionRepository;
    private final DriftEvaluator driftEvaluator;
    private final DriftProperties driftProperties;

    public DriftService(
            ThreadRepository threadRepository,
            ThreadSnapshotRepository threadSnapshotRepository,
            SourceSessionRepository sourceSessionRepository,
            DriftEvaluator driftEvaluator,
            DriftProperties driftProperties
    ) {
        this.threadRepository = threadRepository;
        this.threadSnapshotRepository = threadSnapshotRepository;
        this.sourceSessionRepository = sourceSessionRepository;
        this.driftEvaluator = driftEvaluator;
        this.driftProperties = driftProperties;
    }

    @Transactional
    public DriftEvaluationResponse evaluateThread(Long threadId) {
        Thread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new ApiException(
                        "THREAD_NOT_FOUND",
                        "The requested thread does not exist.",
                        HttpStatus.NOT_FOUND
                ));
        return DriftEvaluationResponse.from(thread, evaluate(thread));
    }

    /**
     * Re-evaluates a thread already loaded in the current transaction. Callers
     * that just changed a thread's activity use this so drift never lags behind
     * the evidence it is computed from.
     */
    @Transactional
    public DriftEvaluation evaluate(Thread thread) {
        if (!driftProperties.isEnabled()) {
            return DriftEvaluation.inconclusive("Drift evaluation is disabled.");
        }

        DriftEvaluation evaluation = driftEvaluator.evaluate(
                thread.getOriginalIntent(),
                collectActivityTexts(thread.getId()),
                driftProperties.getThreshold()
        );
        if (evaluation.conclusive()) {
            thread.applyDriftEvaluation(evaluation.driftScore(), evaluation.driftStatus());
        }
        return evaluation;
    }

    /** Quietly re-evaluates after a write; never fails the write it follows. */
    @Transactional
    public void evaluateQuietly(Long threadId) {
        threadRepository.findById(threadId).ifPresent(this::evaluate);
    }

    private List<String> collectActivityTexts(Long threadId) {
        List<String> texts = new ArrayList<>();

        List<ThreadSnapshot> snapshots = threadSnapshotRepository.findAllByThreadIdOrderByCreatedAtDesc(threadId);
        snapshots.stream()
                .limit(Math.max(driftProperties.getRecentSnapshots(), 0))
                .forEach(snapshot -> {
                    texts.add(snapshot.getSummary());
                    texts.add(snapshot.getNextAction());
                });

        List<SourceSession> sessions = sourceSessionRepository.findAllByThreadIdOrderByImportedAtDesc(threadId);
        sessions.stream()
                .limit(Math.max(driftProperties.getRecentSessions(), 0))
                .forEach(session -> texts.add(session.getTitle()));

        return texts.stream().filter(text -> text != null && !text.isBlank()).toList();
    }
}
