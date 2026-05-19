package com.jean325.threadkeeper.notification.application;

import com.jean325.threadkeeper.notification.domain.NotificationRule;
import com.jean325.threadkeeper.notification.domain.NotificationRuleRepository;
import com.jean325.threadkeeper.notification.dto.CreateNotificationRuleRequest;
import com.jean325.threadkeeper.notification.dto.NotificationRuleResponse;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationRuleService {

    private final NotificationRuleRepository notificationRuleRepository;
    private final NotificationRuleConfigParser notificationRuleConfigParser;

    public NotificationRuleService(
            NotificationRuleRepository notificationRuleRepository,
            NotificationRuleConfigParser notificationRuleConfigParser
    ) {
        this.notificationRuleRepository = notificationRuleRepository;
        this.notificationRuleConfigParser = notificationRuleConfigParser;
    }

    @Transactional(readOnly = true)
    public List<NotificationRuleResponse> listRules() {
        return notificationRuleRepository.findAll().stream()
                .map(NotificationRuleResponse::from)
                .toList();
    }

    @Transactional
    public NotificationRuleResponse createRule(CreateNotificationRuleRequest request) {
        notificationRuleConfigParser.validate(request.configJson());
        NotificationRule rule = new NotificationRule(
                request.ruleType(),
                request.enabled(),
                request.channel(),
                request.thresholdMinutes(),
                request.scheduledTime(),
                request.configJson()
        );
        return NotificationRuleResponse.from(notificationRuleRepository.save(rule));
    }
}
