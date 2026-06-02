package com.jean325.threadkeeper.provider.dto;

import com.jean325.threadkeeper.provider.dto.ImportSourceSessionsRequest.SourceSessionImportRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ImportSourceSessionsRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    @Test
    void rejectsOriginalIntentLongerThan4000() {
        ImportSourceSessionsRequest request = requestWith("a".repeat(4001), "next");

        Set<ConstraintViolation<ImportSourceSessionsRequest>> violations = validator.validate(request);

        assertThat(violations)
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("sourceSessions[0].originalIntent");
    }

    @Test
    void rejectsNextActionLongerThan4000() {
        ImportSourceSessionsRequest request = requestWith("intent", "a".repeat(4001));

        Set<ConstraintViolation<ImportSourceSessionsRequest>> violations = validator.validate(request);

        assertThat(violations)
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("sourceSessions[0].nextAction");
    }

    @Test
    void acceptsOriginalIntentAndNextActionAtMaxLength() {
        ImportSourceSessionsRequest request = requestWith("a".repeat(4000), "b".repeat(4000));

        Set<ConstraintViolation<ImportSourceSessionsRequest>> violations = validator.validate(request);

        assertThat(violations).isEmpty();
    }

    private ImportSourceSessionsRequest requestWith(String originalIntent, String nextAction) {
        SourceSessionImportRequest session = new SourceSessionImportRequest(
                null,
                "example-api",
                "CODEX",
                "id-1",
                "session",
                "/p/rollout.jsonl",
                "Fix login",
                "{}",
                originalIntent,
                nextAction,
                "2026-05-01T10:00:00Z",
                "2026-05-01T10:30:00Z"
        );
        return new ImportSourceSessionsRequest("full", false, List.of(session));
    }
}
