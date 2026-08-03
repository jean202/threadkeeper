package com.jean325.threadkeeper.notification.api;

import com.jean325.threadkeeper.notification.application.NotificationRuleService;
import com.jean325.threadkeeper.notification.dto.CreateNotificationRuleRequest;
import com.jean325.threadkeeper.notification.dto.NotificationRuleResponse;
import com.jean325.threadkeeper.notification.dto.UpdateNotificationRuleRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notification-rules")
public class NotificationRuleController {

    private final NotificationRuleService notificationRuleService;

    public NotificationRuleController(NotificationRuleService notificationRuleService) {
        this.notificationRuleService = notificationRuleService;
    }

    @GetMapping
    public List<NotificationRuleResponse> listRules() {
        return notificationRuleService.listRules();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NotificationRuleResponse createRule(@Valid @RequestBody CreateNotificationRuleRequest request) {
        return notificationRuleService.createRule(request);
    }

    @PatchMapping("/{ruleId}")
    public NotificationRuleResponse updateRule(
            @PathVariable Long ruleId,
            @Valid @RequestBody UpdateNotificationRuleRequest request
    ) {
        return notificationRuleService.updateRule(ruleId, request);
    }
}
