package com.jean325.threadkeeper.notification.application;

import com.jean325.threadkeeper.notification.domain.NotificationProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class NotificationAutomationScheduler {

    private final NotificationRuleEvaluator notificationRuleEvaluator;
    private final NotificationEventService notificationEventService;
    private final NotificationProperties notificationProperties;

    public NotificationAutomationScheduler(
            NotificationRuleEvaluator notificationRuleEvaluator,
            NotificationEventService notificationEventService,
            NotificationProperties notificationProperties
    ) {
        this.notificationRuleEvaluator = notificationRuleEvaluator;
        this.notificationEventService = notificationEventService;
        this.notificationProperties = notificationProperties;
    }

    @Scheduled(
            initialDelayString = "${threadkeeper.notifications.scheduler.evaluation-delay-ms:60000}",
            fixedDelayString = "${threadkeeper.notifications.scheduler.evaluation-delay-ms:60000}"
    )
    public void evaluateRules() {
        if (!notificationProperties.getScheduler().isEnabled()) {
            return;
        }
        notificationRuleEvaluator.evaluateNow();
    }

    @Scheduled(
            initialDelayString = "${threadkeeper.notifications.scheduler.dispatch-delay-ms:30000}",
            fixedDelayString = "${threadkeeper.notifications.scheduler.dispatch-delay-ms:30000}"
    )
    public void dispatchQueuedNotifications() {
        if (!notificationProperties.getScheduler().isEnabled()) {
            return;
        }
        notificationEventService.dispatchQueued();
    }
}
