package com.jean325.threadkeeper.drift.domain;

import com.jean325.threadkeeper.thread.domain.DriftStatus;
import java.math.BigDecimal;

/**
 * The outcome of comparing a thread's original intent with what it has actually
 * been doing.
 *
 * <p>{@code conclusive} is false when there was not enough to compare -- no
 * recorded activity yet, or an intent with no usable terms. A thread nobody has
 * worked on has not drifted, so an inconclusive result must leave the stored
 * drift status alone rather than reporting DRIFTING by default.
 */
public record DriftEvaluation(
        boolean conclusive,
        BigDecimal driftScore,
        DriftStatus driftStatus,
        String explanation
) {
    public static DriftEvaluation inconclusive(String explanation) {
        return new DriftEvaluation(false, null, null, explanation);
    }
}
