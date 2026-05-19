package com.jean325.threadkeeper.notification.domain;

import com.jean325.threadkeeper.thread.domain.Thread;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationEventRepository extends JpaRepository<NotificationEvent, Long> {
    List<NotificationEvent> findAllByOrderByCreatedAtDesc();
    List<NotificationEvent> findAllByDeliveryStatusOrderByCreatedAtAsc(NotificationDeliveryStatus deliveryStatus);
    List<NotificationEvent> findAllByThreadIdOrderByCreatedAtDesc(Long threadId);
    boolean existsByThreadAndRuleAndCreatedAtAfter(Thread thread, NotificationRule rule, Instant createdAt);
}
