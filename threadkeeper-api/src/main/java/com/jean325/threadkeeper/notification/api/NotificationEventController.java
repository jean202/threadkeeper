package com.jean325.threadkeeper.notification.api;

import com.jean325.threadkeeper.notification.application.NotificationEventService;
import com.jean325.threadkeeper.notification.application.NotificationRuleEvaluator;
import com.jean325.threadkeeper.notification.dto.DispatchNotificationsResponse;
import com.jean325.threadkeeper.notification.dto.EvaluateNotificationRulesResponse;
import com.jean325.threadkeeper.notification.dto.NotificationEventResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notification-events")
public class NotificationEventController {

    private final NotificationEventService notificationEventService;
    private final NotificationRuleEvaluator notificationRuleEvaluator;

    public NotificationEventController(
            NotificationEventService notificationEventService,
            NotificationRuleEvaluator notificationRuleEvaluator
    ) {
        this.notificationEventService = notificationEventService;
        this.notificationRuleEvaluator = notificationRuleEvaluator;
    }

    @GetMapping
    public List<NotificationEventResponse> listEvents() {
        return notificationEventService.listEvents();
    }

    @PostMapping("/dispatch")
    public DispatchNotificationsResponse dispatchQueued() {
        return notificationEventService.dispatchQueued();
    }

    @PostMapping("/evaluate")
    public EvaluateNotificationRulesResponse evaluateRules() {
        return notificationRuleEvaluator.evaluateNow();
    }
}
