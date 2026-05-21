package com.jean325.threadkeeper.snapshot.domain;

import com.jean325.threadkeeper.global.common.BaseEntity;
import com.jean325.threadkeeper.thread.domain.DriftStatus;
import com.jean325.threadkeeper.thread.domain.Thread;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "thread_snapshots")
public class ThreadSnapshot extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "thread_id")
    private Thread thread;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SnapshotType snapshotType;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(nullable = false)
    private String summary;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    private String nextAction;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    private String blockers;

    private BigDecimal driftScore;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private DriftStatus driftStatus;

    protected ThreadSnapshot() {
    }

    public ThreadSnapshot(
            Thread thread,
            SnapshotType snapshotType,
            String summary,
            String nextAction,
            String blockers,
            BigDecimal driftScore,
            DriftStatus driftStatus
    ) {
        this.thread = thread;
        this.snapshotType = snapshotType;
        this.summary = summary;
        this.nextAction = nextAction;
        this.blockers = blockers;
        this.driftScore = driftScore;
        this.driftStatus = driftStatus;
    }

    public Long getId() {
        return id;
    }

    public Thread getThread() {
        return thread;
    }

    public SnapshotType getSnapshotType() {
        return snapshotType;
    }

    public String getSummary() {
        return summary;
    }

    public String getNextAction() {
        return nextAction;
    }

    public String getBlockers() {
        return blockers;
    }

    public BigDecimal getDriftScore() {
        return driftScore;
    }

    public DriftStatus getDriftStatus() {
        return driftStatus;
    }
}
