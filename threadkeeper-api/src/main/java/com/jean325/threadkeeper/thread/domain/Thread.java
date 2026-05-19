package com.jean325.threadkeeper.thread.domain;

import com.jean325.threadkeeper.global.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.Instant;

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

    @Lob
    @Column(nullable = false)
    private String originalIntent;

    @Lob
    private String todayGoal;

    @Lob
    private String doneCondition;

    @Lob
    private String currentNextAction;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DriftStatus driftStatus;

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
}
