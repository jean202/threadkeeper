package com.jean325.threadkeeper.drift.domain;

import com.jean325.threadkeeper.thread.domain.DriftStatus;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Scores how far a thread's recent activity has moved from its original intent.
 *
 * <p>Deliberately lexical, per the integration architecture's drift model: "drift
 * does not need full agent autonomy, start with a simple scoring model". It asks
 * one question -- how much of the intent's vocabulary still shows up in what the
 * thread is doing -- and reports the shortfall as a 0-100 score.
 */
@Component
public class DriftEvaluator {

    /**
     * Words carrying no topical signal. Without this an intent and an unrelated
     * summary still overlap on "the", "and", "to" and look on-track.
     */
    private static final Set<String> STOP_WORDS = Set.of(
            "the", "and", "for", "with", "that", "this", "from", "into", "onto", "over",
            "then", "than", "them", "they", "have", "has", "had", "was", "were", "will",
            "would", "should", "could", "can", "are", "but", "not", "you", "your", "our",
            "its", "it's", "all", "any", "get", "got", "use", "used", "using", "make",
            "made", "when", "what", "why", "how", "who", "which", "while", "some", "more",
            "most", "much", "very", "just", "also", "now", "new", "old", "out", "off",
            "add", "added", "adding", "one", "two", "let", "via", "per", "yet", "still"
    );

    private static final int MIN_TERM_LENGTH = 3;

    /**
     * @param originalIntent the immutable first-intent note
     * @param activityTexts  recent progress summaries, next actions, session titles
     * @param driftThreshold score at or above which the thread counts as DRIFTING
     */
    public DriftEvaluation evaluate(String originalIntent, List<String> activityTexts, int driftThreshold) {
        Set<String> intentTerms = terms(originalIntent);
        if (intentTerms.isEmpty()) {
            return DriftEvaluation.inconclusive("The original intent has no comparable terms.");
        }

        Set<String> activityTerms = new LinkedHashSet<>();
        for (String text : activityTexts) {
            activityTerms.addAll(terms(text));
        }
        if (activityTerms.isEmpty()) {
            return DriftEvaluation.inconclusive("No recorded activity to compare against the original intent.");
        }

        long matched = intentTerms.stream().filter(activityTerms::contains).count();
        BigDecimal coverage = BigDecimal.valueOf(matched)
                .divide(BigDecimal.valueOf(intentTerms.size()), 4, RoundingMode.HALF_UP);
        BigDecimal driftScore = BigDecimal.ONE.subtract(coverage)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);

        DriftStatus status = driftScore.compareTo(BigDecimal.valueOf(driftThreshold)) >= 0
                ? DriftStatus.DRIFTING
                : DriftStatus.ON_TRACK;
        String explanation = "%d of %d intent terms still present in recent activity.".formatted(matched, intentTerms.size());
        return new DriftEvaluation(true, driftScore, status, explanation);
    }

    private Set<String> terms(String text) {
        if (text == null || text.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(text.toLowerCase().split("[^\\p{L}\\p{N}]+"))
                .filter(token -> token.length() >= MIN_TERM_LENGTH)
                .map(this::normalize)
                .filter(token -> !STOP_WORDS.contains(token))
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
    }

    /**
     * Folds simple plurals together so "webhooks" matches "webhook" and
     * "retries" matches "retry". Words ending in "ss" are left alone so "css"
     * does not become "cs".
     */
    private String normalize(String token) {
        if (token.length() > MIN_TERM_LENGTH + 1 && token.endsWith("ies")) {
            return token.substring(0, token.length() - 3) + "y";
        }
        if (token.length() > MIN_TERM_LENGTH && token.endsWith("s") && !token.endsWith("ss")) {
            return token.substring(0, token.length() - 1);
        }
        return token;
    }
}
