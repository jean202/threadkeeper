package com.jean325.threadkeeper.drift.dto;

import com.jean325.threadkeeper.drift.domain.DriftEvaluation;
import com.jean325.threadkeeper.thread.domain.Thread;
import java.math.BigDecimal;

public record DriftEvaluationResponse(
        Long threadId,
        boolean conclusive,
        BigDecimal driftScore,
        String driftStatus,
        String explanation
) {
    public static DriftEvaluationResponse from(Thread thread, DriftEvaluation evaluation) {
        return new DriftEvaluationResponse(
                thread.getId(),
                evaluation.conclusive(),
                thread.getDriftScore(),
                thread.getDriftStatus().name(),
                evaluation.explanation()
        );
    }
}
