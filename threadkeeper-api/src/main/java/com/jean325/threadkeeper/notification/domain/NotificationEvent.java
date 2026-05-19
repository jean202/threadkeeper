package com.jean325.threadkeeper.notification.domain;

import com.jean325.threadkeeper.global.common.BaseEntity;
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
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "notification_events")
public class NotificationEvent extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "thread_id")
    private Thread thread;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rule_id")
    private NotificationRule rule;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NotificationRuleType eventType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NotificationChannel channel;

    @Lob
    @Column(nullable = false)
    private String payloadJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NotificationDeliveryStatus deliveryStatus;

    private Instant sentAt;

    protected NotificationEvent() {
    }

    public NotificationEvent(
            Thread thread,
            NotificationRule rule,
            NotificationRuleType eventType,
            NotificationChannel channel,
            String payloadJson,
            NotificationDeliveryStatus deliveryStatus
    ) {
        this.thread = thread;
        this.rule = rule;
        this.eventType = eventType;
        this.channel = channel;
        this.payloadJson = payloadJson == null || payloadJson.isBlank() ? "{}" : payloadJson;
        this.deliveryStatus = deliveryStatus;
    }

    public Long getId() {
        return id;
    }

    public Thread getThread() {
        return thread;
    }

    public NotificationRule getRule() {
        return rule;
    }

    public NotificationRuleType getEventType() {
        return eventType;
    }

    public NotificationChannel getChannel() {
        return channel;
    }

    public String getPayloadJson() {
        return payloadJson;
    }

    public NotificationDeliveryStatus getDeliveryStatus() {
        return deliveryStatus;
    }

    public Instant getSentAt() {
        return sentAt;
    }

    public void markSent() {
        this.deliveryStatus = NotificationDeliveryStatus.SENT;
        this.sentAt = Instant.now();
    }

    public void markFailed() {
        this.deliveryStatus = NotificationDeliveryStatus.FAILED;
        this.sentAt = null;
    }
}
