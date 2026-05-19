package com.jean325.threadkeeper.notification.application;

import com.jean325.threadkeeper.notification.domain.NotificationRule;
import com.jean325.threadkeeper.notification.domain.NotificationRuleConfig;
import com.jean325.threadkeeper.notification.domain.NotificationRuleRepository;
import com.jean325.threadkeeper.notification.dto.EvaluateNotificationRulesResponse;
import com.jean325.threadkeeper.thread.domain.DriftStatus;
import com.jean325.threadkeeper.thread.domain.Thread;
import com.jean325.threadkeeper.thread.domain.ThreadPriority;
import com.jean325.threadkeeper.thread.domain.ThreadRepository;
import com.jean325.threadkeeper.thread.domain.ThreadStatus;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationRuleEvaluator {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    private final NotificationRuleRepository notificationRuleRepository;
    private final ThreadRepository threadRepository;
    private final NotificationEventService notificationEventService;
    private final NotificationRuleConfigParser notificationRuleConfigParser;

    public NotificationRuleEvaluator(
            NotificationRuleRepository notificationRuleRepository,
            ThreadRepository threadRepository,
            NotificationEventService notificationEventService,
            NotificationRuleConfigParser notificationRuleConfigParser
    ) {
        this.notificationRuleRepository = notificationRuleRepository;
        this.threadRepository = threadRepository;
        this.notificationEventService = notificationEventService;
        this.notificationRuleConfigParser = notificationRuleConfigParser;
    }

    @Transactional
    public EvaluateNotificationRulesResponse evaluateNow() {
        int queuedCount = 0;
        List<NotificationRule> rules = notificationRuleRepository.findAll().stream()
                .filter(NotificationRule::isEnabled)
                .toList();

        for (NotificationRule rule : rules) {
            NotificationRuleConfig config = notificationRuleConfigParser.parse(rule.getConfigJson());
            queuedCount += switch (rule.getRuleType()) {
                case INACTIVITY -> queueInactivity(rule, config);
                case DAILY_BRIEFING -> queueDailyBriefing(rule, config);
                case DRIFT_ALERT -> queueDriftAlerts(rule, config);
                case COMPLETION -> 0;
            };
        }

        return new EvaluateNotificationRulesResponse(queuedCount);
    }

    private int queueInactivity(NotificationRule rule, NotificationRuleConfig config) {
        int queued = 0;
        if (rule.getThresholdMinutes() == null) {
            return 0;
        }

        var now = ZonedDateTime.now(SEOUL).toInstant();
        for (Thread thread : threadRepository.findAllByOrderByLastActivityAtDesc()) {
            if (!isCandidateThread(thread, config) || thread.getLastActivityAt() == null) {
                continue;
            }
            long inactiveMinutes = Duration.between(thread.getLastActivityAt(), now).toMinutes();
            if (inactiveMinutes >= rule.getThresholdMinutes()) {
                int cooldownMinutes = config.cooldownMinutes() == null
                        ? Math.max(rule.getThresholdMinutes(), 1)
                        : Math.max(config.cooldownMinutes(), 1);
                boolean queuedNow = notificationEventService.queueForRuleIfAbsentSince(
                        thread,
                        rule,
                        "{\"message\":\"Thread inactive\",\"threadId\":" + thread.getId() + ",\"inactiveMinutes\":" + inactiveMinutes + "}",
                        Instant.now().minus(Duration.ofMinutes(cooldownMinutes))
                );
                if (queuedNow) {
                    queued += 1;
                }
            }
        }
        return queued;
    }

    private int queueDailyBriefing(NotificationRule rule, NotificationRuleConfig config) {
        if (rule.getScheduledTime() == null || rule.getScheduledTime().isBlank()) {
            return 0;
        }
        LocalTime scheduled = LocalTime.parse(rule.getScheduledTime());
        LocalTime now = LocalTime.now(SEOUL);
        if (now.getHour() != scheduled.getHour() || now.getMinute() != scheduled.getMinute()) {
            return 0;
        }

        List<Thread> activeThreads = threadRepository.findAllByOrderByLastActivityAtDesc().stream()
                .filter(thread -> isCandidateThread(thread, config))
                .sorted((left, right) -> Integer.compare(scoreForBriefing(right), scoreForBriefing(left)))
                .limit(config.topN() == null || config.topN() < 1 ? 3 : config.topN())
                .toList();
        if (activeThreads.isEmpty()) {
            return 0;
        }

        Instant dayStart = ZonedDateTime.now(SEOUL).toLocalDate()
                .atStartOfDay(SEOUL)
                .toInstant();
        int queued = 0;
        for (Thread thread : activeThreads) {
            boolean queuedNow = notificationEventService.queueForRuleIfAbsentSince(
                    thread,
                    rule,
                    "{\"message\":\"Daily briefing\",\"threadId\":" + thread.getId() + "}",
                    dayStart
            );
            if (queuedNow) {
                queued += 1;
            }
        }
        return queued;
    }

    private int queueDriftAlerts(NotificationRule rule, NotificationRuleConfig config) {
        int queued = 0;
        for (Thread thread : threadRepository.findAllByOrderByLastActivityAtDesc()) {
            if (!isCandidateThread(thread, config)) {
                continue;
            }
            if (matchesDriftConfig(thread, config)) {
                int cooldownMinutes = config.cooldownMinutes() == null ? 60 : Math.max(config.cooldownMinutes(), 1);
                boolean queuedNow = notificationEventService.queueForRuleIfAbsentSince(
                        thread,
                        rule,
                        "{\"message\":\"Thread drift detected\",\"threadId\":" + thread.getId() + ",\"driftStatus\":\"" + thread.getDriftStatus().name() + "\"}",
                        Instant.now().minus(Duration.ofMinutes(cooldownMinutes))
                );
                if (queuedNow) {
                    queued += 1;
                }
            }
        }
        return queued;
    }

    private boolean isCandidateThread(Thread thread, NotificationRuleConfig config) {
        if (thread.getStatus() != ThreadStatus.ACTIVE) {
            return false;
        }
        if (!config.projectKeys().isEmpty() && !config.projectKeys().contains(thread.getProjectKey())) {
            return false;
        }
        if (config.excludeProjectKeys().contains(thread.getProjectKey())) {
            return false;
        }
        if (config.minimumPriority() != null && priorityRank(thread.getPriority()) < priorityRank(config.minimumPriority())) {
            return false;
        }
        if (config.onlyIfMissingNextAction()
                && thread.getCurrentNextAction() != null
                && !thread.getCurrentNextAction().isBlank()) {
            return false;
        }
        if (config.staleMinutes() != null && thread.getLastActivityAt() != null) {
            long staleMinutes = Duration.between(thread.getLastActivityAt(), Instant.now()).toMinutes();
            if (staleMinutes < config.staleMinutes()) {
                return false;
            }
        }
        return true;
    }

    private boolean matchesDriftConfig(Thread thread, NotificationRuleConfig config) {
        if (config.driftStatuses().isEmpty()) {
            return thread.getDriftStatus() == DriftStatus.DRIFTING || thread.getDriftStatus() == DriftStatus.BLOCKED;
        }
        return config.driftStatuses().contains(thread.getDriftStatus());
    }

    private int priorityRank(ThreadPriority priority) {
        return switch (priority) {
            case LOW -> 1;
            case MEDIUM -> 2;
            case HIGH -> 3;
        };
    }

    private int scoreForBriefing(Thread thread) {
        int score = priorityRank(thread.getPriority()) * 10;
        if (thread.getDriftStatus() == DriftStatus.BLOCKED) {
            score += 20;
        } else if (thread.getDriftStatus() == DriftStatus.DRIFTING) {
            score += 10;
        }
        if (thread.getCurrentNextAction() == null || thread.getCurrentNextAction().isBlank()) {
            score -= 5;
        } else {
            score += 5;
        }
        if (thread.getLastActivityAt() != null) {
            score += (int) Math.min(Duration.between(thread.getLastActivityAt(), Instant.now()).toMinutes() / 60, 12);
        }
        return score;
    }
}
