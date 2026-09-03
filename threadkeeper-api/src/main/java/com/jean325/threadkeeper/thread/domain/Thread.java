package com.jean325.threadkeeper.thread.domain;

import com.jean325.threadkeeper.global.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "threads")
public class Thread extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String projectKey;

    @Column(nullable = false, length = 200)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ThreadStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ThreadPriority priority;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(nullable = false)
    private String originalIntent;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    private String todayGoal;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    private String doneCondition;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    private String currentNextAction;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DriftStatus driftStatus;

    /** Null until drift has been evaluated with enough activity to compare. */
    @Column(precision = 5, scale = 2)
    private BigDecimal driftScore;

    private Instant lastActivityAt;

    private Instant completedAt;

    protected Thread() {
    }

    public Thread(
            String projectKey,
            String title,
            ThreadPriority priority,
            String originalIntent,
            String todayGoal,
            String doneCondition
    ) {
        this.projectKey = projectKey;
        this.title = title;
        this.priority = priority;
        this.originalIntent = originalIntent;
        this.todayGoal = todayGoal;
        this.doneCondition = doneCondition;
        this.status = ThreadStatus.ACTIVE;
        this.driftStatus = DriftStatus.ON_TRACK;
        this.currentNextAction = todayGoal;
        this.lastActivityAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getProjectKey() {
        return projectKey;
    }

    public String getTitle() {
        return title;
    }

    public ThreadStatus getStatus() {
        return status;
    }

    public ThreadPriority getPriority() {
        return priority;
    }

    public String getOriginalIntent() {
        return originalIntent;
    }

    public String getTodayGoal() {
        return todayGoal;
    }

    public String getDoneCondition() {
        return doneCondition;
    }

    public String getCurrentNextAction() {
        return currentNextAction;
    }

    public DriftStatus getDriftStatus() {
        return driftStatus;
    }

    public BigDecimal getDriftScore() {
        return driftScore;
    }

    /**
     * Records a computed drift result. Status-owned states win: a completed or
     * blocked thread keeps saying so, because those describe the thread itself
     * rather than how far it has wandered.
     */
    public void applyDriftEvaluation(BigDecimal driftScore, DriftStatus evaluatedStatus) {
        this.driftScore = driftScore;
        if (status == ThreadStatus.COMPLETED) {
            this.driftStatus = DriftStatus.COMPLETED;
        } else if (status == ThreadStatus.BLOCKED) {
            this.driftStatus = DriftStatus.BLOCKED;
        } else {
            this.driftStatus = evaluatedStatus;
        }
    }

    public Instant getLastActivityAt() {
        return lastActivityAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void updateStatus(ThreadStatus status) {
        this.status = status;
        this.lastActivityAt = Instant.now();
        if (status == ThreadStatus.COMPLETED) {
            this.completedAt = Instant.now();
            this.driftStatus = DriftStatus.COMPLETED;
        } else if (status == ThreadStatus.BLOCKED) {
            this.driftStatus = DriftStatus.BLOCKED;
        } else if (driftStatus == DriftStatus.COMPLETED || driftStatus == DriftStatus.BLOCKED) {
            // Reopening leaves the thread in a state drift can speak about again;
            // the next evaluation replaces this.
            this.driftStatus = DriftStatus.ON_TRACK;
        }
    }

    public void updateNextAction(String currentNextAction) {
        this.currentNextAction = currentNextAction;
        this.lastActivityAt = Instant.now();
    }

    public void touch(String inferredNextAction) {
        this.lastActivityAt = Instant.now();
        if (inferredNextAction != null && !inferredNextAction.isBlank()) {
            this.currentNextAction = inferredNextAction;
        }
    }

    public void applyImportedSession(String originalIntent, String currentNextAction, Instant lastActivityAt) {
        if (originalIntent != null && !originalIntent.isBlank()) {
            this.originalIntent = originalIntent;
        }
        if (currentNextAction != null && !currentNextAction.isBlank()) {
            this.currentNextAction = currentNextAction;
        }
        if (lastActivityAt != null) {
            this.lastActivityAt = lastActivityAt;
        }
    }
}
