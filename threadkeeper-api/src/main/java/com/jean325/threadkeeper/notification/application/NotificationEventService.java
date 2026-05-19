package com.jean325.threadkeeper.notification.application;

import com.jean325.threadkeeper.notification.domain.NotificationDeliveryStatus;
import com.jean325.threadkeeper.notification.domain.NotificationChannelDispatcher;
import com.jean325.threadkeeper.notification.domain.NotificationEvent;
import com.jean325.threadkeeper.notification.domain.NotificationEventRepository;
import com.jean325.threadkeeper.notification.domain.NotificationRule;
import com.jean325.threadkeeper.notification.domain.NotificationRuleRepository;
import com.jean325.threadkeeper.notification.domain.NotificationRuleType;
import com.jean325.threadkeeper.notification.dto.DispatchNotificationsResponse;
import com.jean325.threadkeeper.notification.dto.NotificationEventResponse;
import com.jean325.threadkeeper.thread.domain.Thread;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationEventService {

    private final NotificationEventRepository notificationEventRepository;
    private final NotificationRuleRepository notificationRuleRepository;
    private final java.util.List<NotificationChannelDispatcher> dispatchers;

    public NotificationEventService(
            NotificationEventRepository notificationEventRepository,
            NotificationRuleRepository notificationRuleRepository,
            java.util.List<NotificationChannelDispatcher> dispatchers
    ) {
        this.notificationEventRepository = notificationEventRepository;
        this.notificationRuleRepository = notificationRuleRepository;
        this.dispatchers = dispatchers;
    }

    @Transactional(readOnly = true)
    public List<NotificationEventResponse> listEvents() {
        return notificationEventRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(NotificationEventResponse::from)
                .toList();
    }

    @Transactional
    public void queueForThread(Thread thread, NotificationRuleType eventType, String payloadJson) {
        List<NotificationRule> rules = notificationRuleRepository.findAll().stream()
                .filter(NotificationRule::isEnabled)
                .filter(rule -> rule.getRuleType() == eventType)
                .toList();

        for (NotificationRule rule : rules) {
            queueForRule(thread, rule, payloadJson);
        }
    }

    @Transactional
    public boolean queueForRuleIfAbsentSince(Thread thread, NotificationRule rule, String payloadJson, Instant since) {
        if (notificationEventRepository.existsByThreadAndRuleAndCreatedAtAfter(thread, rule, since)) {
            return false;
        }
        queueForRule(thread, rule, payloadJson);
        return true;
    }

    @Transactional
    public DispatchNotificationsResponse dispatchQueued() {
        List<NotificationEvent> queued = notificationEventRepository
                .findAllByDeliveryStatusOrderByCreatedAtAsc(NotificationDeliveryStatus.QUEUED);
        for (NotificationEvent event : queued) {
            try {
                dispatch(event);
                event.markSent();
            } catch (RuntimeException ex) {
                event.markFailed();
            }
        }
        return new DispatchNotificationsResponse(queued.size());
    }

    private void dispatch(NotificationEvent event) {
        NotificationChannelDispatcher dispatcher = dispatchers.stream()
                .filter(candidate -> candidate.supports(event.getChannel()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No dispatcher registered for " + event.getChannel()));
        dispatcher.dispatch(event);
    }

    private void queueForRule(Thread thread, NotificationRule rule, String payloadJson) {
        notificationEventRepository.save(new NotificationEvent(
                thread,
                rule,
                rule.getRuleType(),
                rule.getChannel(),
                payloadJson,
                NotificationDeliveryStatus.QUEUED
        ));
    }
}
