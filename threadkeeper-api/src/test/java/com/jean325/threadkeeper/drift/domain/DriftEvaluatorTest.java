package com.jean325.threadkeeper.drift.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.jean325.threadkeeper.thread.domain.DriftStatus;
import java.util.List;
import org.junit.jupiter.api.Test;

class DriftEvaluatorTest {

    private static final int THRESHOLD = 60;

    private final DriftEvaluator evaluator = new DriftEvaluator();

    @Test
    void workOnTheStatedTopicStaysOnTrack() {
        DriftEvaluation evaluation = evaluator.evaluate(
                "Implement billing webhook retry logic",
                List.of("Added retry backoff to the billing webhook handler."),
                THRESHOLD
        );

        assertThat(evaluation.conclusive()).isTrue();
        assertThat(evaluation.driftStatus()).isEqualTo(DriftStatus.ON_TRACK);
        assertThat(evaluation.driftScore()).isEqualByComparingTo("40.00");
    }

    @Test
    void unrelatedWorkDrifts() {
        // PRD scenario C: started as billing webhook retry, wandered into refactors.
        DriftEvaluation evaluation = evaluator.evaluate(
                "Implement billing webhook retry logic",
                List.of("Renamed components and reworked the css theme."),
                THRESHOLD
        );

        assertThat(evaluation.driftStatus()).isEqualTo(DriftStatus.DRIFTING);
        assertThat(evaluation.driftScore()).isEqualByComparingTo("100.00");
    }

    @Test
    void aThreadWithNoActivityIsNotJudged() {
        // Absence of evidence is not drift -- a brand new thread would otherwise
        // score 100 and alert immediately.
        DriftEvaluation evaluation = evaluator.evaluate(
                "Implement billing webhook retry logic",
                List.of(),
                THRESHOLD
        );

        assertThat(evaluation.conclusive()).isFalse();
        assertThat(evaluation.driftScore()).isNull();
        assertThat(evaluation.driftStatus()).isNull();
    }

    @Test
    void blankActivityTextIsTreatedAsNoActivity() {
        DriftEvaluation evaluation = evaluator.evaluate(
                "Implement billing webhook retry logic",
                List.of("   ", ""),
                THRESHOLD
        );

        assertThat(evaluation.conclusive()).isFalse();
    }

    @Test
    void anIntentWithNoMeaningfulTermsIsNotJudged() {
        DriftEvaluation evaluation = evaluator.evaluate(
                "the and for with",
                List.of("Renamed components."),
                THRESHOLD
        );

        assertThat(evaluation.conclusive()).isFalse();
    }

    @Test
    void stopWordsDoNotCreateFalseOverlap() {
        // Both sides share "the"/"and"/"with" and nothing else that matters.
        DriftEvaluation evaluation = evaluator.evaluate(
                "Rewrite the importer and the parser",
                List.of("Updated the changelog with the release notes."),
                THRESHOLD
        );

        assertThat(evaluation.driftStatus()).isEqualTo(DriftStatus.DRIFTING);
        assertThat(evaluation.driftScore()).isEqualByComparingTo("100.00");
    }

    @Test
    void simplePluralsMatchTheirSingularForm() {
        // "webhooks" -> "webhook" and "retries" -> "retry"; "fix" is dropped
        // because the activity says "fixed", which this normalizer does not stem.
        DriftEvaluation evaluation = evaluator.evaluate(
                "webhook retry",
                List.of("Fixed webhooks and retries."),
                THRESHOLD
        );

        assertThat(evaluation.driftStatus()).isEqualTo(DriftStatus.ON_TRACK);
        assertThat(evaluation.driftScore()).isEqualByComparingTo("0.00");
    }

    @Test
    void verbTensesAreNotStemmed() {
        // A known limit of the simple model: "implement" and "implemented" are
        // different terms. Recorded so the behaviour is a decision, not a surprise.
        DriftEvaluation evaluation = evaluator.evaluate(
                "implement retry",
                List.of("Implemented the retry."),
                THRESHOLD
        );

        assertThat(evaluation.driftScore()).isEqualByComparingTo("50.00");
    }

    @Test
    void doubleEssWordsAreNotMangledByPluralFolding() {
        // "css" must survive intact: stripping the trailing s would leave "cs",
        // which matches nothing. Intent terms appear verbatim in the activity, so
        // any shortfall here is the normalizer's doing.
        DriftEvaluation evaluation = evaluator.evaluate(
                "css grid",
                List.of("Reworked the css grid spacing."),
                THRESHOLD
        );

        assertThat(evaluation.driftScore()).isEqualByComparingTo("0.00");
    }

    @Test
    void extraUnrelatedActivityCannotPushAnOnTopicThreadIntoDrift() {
        // The score measures how much of the intent survives, so boilerplate the
        // importer writes must not count against the thread.
        DriftEvaluation focused = evaluator.evaluate(
                "Implement billing webhook retry logic",
                List.of("Added retry backoff to the billing webhook handler."),
                THRESHOLD
        );
        DriftEvaluation withNoise = evaluator.evaluate(
                "Implement billing webhook retry logic",
                List.of(
                        "Added retry backoff to the billing webhook handler.",
                        "Imported source session from CODEX.",
                        "Review imported thread and decide whether to merge or continue."
                ),
                THRESHOLD
        );

        assertThat(withNoise.driftScore()).isLessThanOrEqualTo(focused.driftScore());
        assertThat(withNoise.driftStatus()).isEqualTo(DriftStatus.ON_TRACK);
    }

    @Test
    void theThresholdDecidesWhereDriftingStarts() {
        List<String> activity = List.of("Added retry backoff to the billing webhook handler.");

        assertThat(evaluator.evaluate("Implement billing webhook retry logic", activity, 40).driftStatus())
                .isEqualTo(DriftStatus.DRIFTING);
        assertThat(evaluator.evaluate("Implement billing webhook retry logic", activity, 41).driftStatus())
                .isEqualTo(DriftStatus.ON_TRACK);
    }
}
