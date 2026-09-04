package com.jean325.threadkeeper.thread.domain;

import com.jean325.threadkeeper.source.domain.SourceSession;
import com.jean325.threadkeeper.thread.dto.ThreadSearchCriteria;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/** Builds the thread search query from whichever filters were supplied. */
public final class ThreadSpecifications {

    /** The fields a keyword search looks at -- everything a user would recognise a thread by. */
    private static final List<String> KEYWORD_FIELDS =
            List.of("title", "originalIntent", "currentNextAction", "todayGoal", "doneCondition");

    private ThreadSpecifications() {
    }

    public static Specification<Thread> matching(ThreadSearchCriteria criteria) {
        return (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (criteria.projectKey() != null) {
                predicates.add(builder.equal(
                        builder.lower(root.get("projectKey")),
                        criteria.projectKey().toLowerCase()));
            }

            if (criteria.status() != null) {
                predicates.add(builder.equal(root.get("status"), criteria.status()));
            }

            if (criteria.priority() != null) {
                predicates.add(builder.equal(root.get("priority"), criteria.priority()));
            }

            if (criteria.activeWithinDays() != null) {
                Instant since = Instant.now().minus(Duration.ofDays(criteria.activeWithinDays()));
                // Threads that never recorded activity fall out here on their own:
                // comparing NULL yields unknown, which the WHERE clause discards.
                predicates.add(builder.greaterThanOrEqualTo(root.get("lastActivityAt"), since));
            }

            if (criteria.keyword() != null) {
                String pattern = "%" + criteria.keyword().toLowerCase() + "%";
                List<Predicate> anyField = KEYWORD_FIELDS.stream()
                        .map(field -> (Predicate) builder.like(builder.lower(root.get(field)), pattern))
                        .toList();
                predicates.add(builder.or(anyField.toArray(new Predicate[0])));
            }

            if (criteria.provider() != null && query != null) {
                // Provider lives on the imported sessions, not the thread, so match
                // threads that have at least one session from that provider.
                Subquery<Long> sessions = query.subquery(Long.class);
                Root<SourceSession> session = sessions.from(SourceSession.class);
                sessions.select(builder.literal(1L))
                        .where(
                                builder.equal(session.get("thread"), root),
                                builder.equal(session.get("provider"), criteria.provider()));
                predicates.add(builder.exists(sessions));
            }

            return predicates.isEmpty() ? null : builder.and(predicates.toArray(new Predicate[0]));
        };
    }
}
