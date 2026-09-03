package com.jean325.threadkeeper.handoff.domain;

import com.jean325.threadkeeper.global.common.BaseEntity;
import com.jean325.threadkeeper.provider.domain.ProviderType;
import com.jean325.threadkeeper.source.domain.SourceSession;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "handoffs")
public class Handoff extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "thread_id")
    private Thread thread;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_session_id")
    private SourceSession sourceSession;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ProviderType targetProvider;

    @Column(length = 100)
    private String reason;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    private String whatChanged;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    private String blockers;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    private String nextAction;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    private String filesNote;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private HandoffStatus status;

    protected Handoff() {
    }

    public Handoff(
            Thread thread,
            SourceSession sourceSession,
            ProviderType targetProvider,
            String reason,
            String whatChanged,
            String blockers,
            String nextAction,
            String filesNote,
            HandoffStatus status
    ) {
        this.thread = thread;
        this.sourceSession = sourceSession;
        this.targetProvider = targetProvider;
        this.reason = reason;
        this.whatChanged = whatChanged;
        this.blockers = blockers;
        this.nextAction = nextAction;
        this.filesNote = filesNote;
        this.status = status;
    }

    public Long getId() {
        return id;
    }

    public Thread getThread() {
        return thread;
    }

    public SourceSession getSourceSession() {
        return sourceSession;
    }

    public ProviderType getTargetProvider() {
        return targetProvider;
    }

    public String getReason() {
        return reason;
    }

    public String getWhatChanged() {
        return whatChanged;
    }

    public String getBlockers() {
        return blockers;
    }

    public String getNextAction() {
        return nextAction;
    }

    public String getFilesNote() {
        return filesNote;
    }

    public HandoffStatus getStatus() {
        return status;
    }

    public void updateStatus(HandoffStatus status) {
        this.status = status;
    }

    /**
     * Replaces the editable body of the handoff. The composer always submits the
     * whole card, so every field is overwritten -- clearing one is a real edit,
     * not a field the caller forgot to send.
     */
    public void updateContent(
            ProviderType targetProvider,
            String reason,
            String whatChanged,
            String blockers,
            String nextAction,
            String filesNote
    ) {
        this.targetProvider = targetProvider;
        this.reason = reason;
        this.whatChanged = whatChanged;
        this.blockers = blockers;
        this.nextAction = nextAction;
        this.filesNote = filesNote;
    }
}
