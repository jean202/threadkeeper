package com.jean325.threadkeeper.notification.application;

import com.jean325.threadkeeper.global.error.ApiException;
import com.jean325.threadkeeper.notification.domain.NotificationEventRepository;
import com.jean325.threadkeeper.notification.domain.NotificationRule;
import com.jean325.threadkeeper.notification.domain.NotificationRuleRepository;
import com.jean325.threadkeeper.notification.dto.CreateNotificationRuleRequest;
import com.jean325.threadkeeper.notification.dto.NotificationRuleResponse;
import com.jean325.threadkeeper.notification.dto.UpdateNotificationRuleRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationRuleService {

    private final NotificationRuleRepository notificationRuleRepository;
    private final NotificationRuleConfigParser notificationRuleConfigParser;
    private final NotificationEventRepository notificationEventRepository;

    public NotificationRuleService(
            NotificationRuleRepository notificationRuleRepository,
            NotificationRuleConfigParser notificationRuleConfigParser,
            NotificationEventRepository notificationEventRepository
    ) {
        this.notificationRuleRepository = notificationRuleRepository;
        this.notificationRuleConfigParser = notificationRuleConfigParser;
        this.notificationEventRepository = notificationEventRepository;
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

    @Transactional
    public NotificationRuleResponse updateRule(Long ruleId, UpdateNotificationRuleRequest request) {
        // An omitted config is not an empty config -- only validate what was sent.
        if (request.configJson() != null) {
            notificationRuleConfigParser.validate(request.configJson());
        }
        NotificationRule rule = findRuleOrThrow(ruleId);
        rule.update(
                request.enabled(),
                request.channel(),
                request.thresholdMinutes(),
                request.scheduledTime(),
                request.configJson()
        );
        return NotificationRuleResponse.from(rule);
    }

    @Transactional
    public void deleteRule(Long ruleId) {
        NotificationRule rule = findRuleOrThrow(ruleId);
        // Events keep a reference to their rule, so drop them first rather than
        // letting the delete fail on a foreign key.
        notificationEventRepository.deleteAllByRuleId(ruleId);
        notificationRuleRepository.delete(rule);
    }

    private NotificationRule findRuleOrThrow(Long ruleId) {
        return notificationRuleRepository.findById(ruleId)
                .orElseThrow(() -> new ApiException(
                        "NOTIFICATION_RULE_NOT_FOUND",
                        "The requested notification rule does not exist.",
                        HttpStatus.NOT_FOUND
                ));
    }
}
