package com.jean325.threadkeeper.notification.domain;

import com.jean325.threadkeeper.global.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "notification_rules")
public class NotificationRule extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NotificationRuleType ruleType;

    @Column(nullable = false)
    private boolean enabled;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NotificationChannel channel;

    private Integer thresholdMinutes;

    @Column(length = 10)
    private String scheduledTime;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(nullable = false)
    private String configJson;

    protected NotificationRule() {
    }

    public NotificationRule(
            NotificationRuleType ruleType,
            boolean enabled,
            NotificationChannel channel,
            Integer thresholdMinutes,
            String scheduledTime,
            String configJson
    ) {
        this.ruleType = ruleType;
        this.enabled = enabled;
        this.channel = channel;
        this.thresholdMinutes = thresholdMinutes;
        this.scheduledTime = scheduledTime;
        this.configJson = configJson == null || configJson.isBlank() ? "{}" : configJson;
    }

    /** Partial update: null arguments leave the current value in place. */
    public void update(
            Boolean enabled,
            NotificationChannel channel,
            Integer thresholdMinutes,
            String scheduledTime,
            String configJson
    ) {
        if (enabled != null) {
            this.enabled = enabled;
        }
        if (channel != null) {
            this.channel = channel;
        }
        if (thresholdMinutes != null) {
            this.thresholdMinutes = thresholdMinutes;
        }
        if (scheduledTime != null) {
            this.scheduledTime = scheduledTime;
        }
        if (configJson != null && !configJson.isBlank()) {
            this.configJson = configJson;
        }
    }

    public Long getId() {
        return id;
    }

    public NotificationRuleType getRuleType() {
        return ruleType;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public NotificationChannel getChannel() {
        return channel;
    }

    public Integer getThresholdMinutes() {
        return thresholdMinutes;
    }

    public String getScheduledTime() {
        return scheduledTime;
    }

    public String getConfigJson() {
        return configJson;
    }
}
