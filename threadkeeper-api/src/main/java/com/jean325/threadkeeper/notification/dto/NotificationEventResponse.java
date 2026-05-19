package com.jean325.threadkeeper.notification.dto;

import com.jean325.threadkeeper.notification.domain.NotificationEvent;
import java.time.Instant;

public record NotificationEventResponse(
        Long id,
        Long threadId,
        Long ruleId,
        String eventType,
        String channel,
        String payloadJson,
        String deliveryStatus,
        Instant sentAt,
        Instant createdAt
) {
    public static NotificationEventResponse from(NotificationEvent event) {
        return new NotificationEventResponse(
                event.getId(),
                event.getThread() == null ? null : event.getThread().getId(),
                event.getRule() == null ? null : event.getRule().getId(),
                event.getEventType().name(),
                event.getChannel().name(),
                event.getPayloadJson(),
                event.getDeliveryStatus().name(),
                event.getSentAt(),
                event.getCreatedAt()
        );
    }
}
