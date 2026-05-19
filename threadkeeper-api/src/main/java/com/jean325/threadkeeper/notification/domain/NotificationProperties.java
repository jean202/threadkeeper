package com.jean325.threadkeeper.notification.domain;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "threadkeeper.notifications")
public class NotificationProperties {

    private final Discord discord = new Discord();
    private final Scheduler scheduler = new Scheduler();

    public Discord getDiscord() {
        return discord;
    }

    public Scheduler getScheduler() {
        return scheduler;
    }

    public static class Discord {
        private String webhookUrl = "";

        public String getWebhookUrl() {
            return webhookUrl;
        }

        public void setWebhookUrl(String webhookUrl) {
            this.webhookUrl = webhookUrl;
        }
    }

    public static class Scheduler {
        private boolean enabled = true;
        private long evaluationDelayMs = 60000;
        private long dispatchDelayMs = 30000;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public long getEvaluationDelayMs() {
            return evaluationDelayMs;
        }

        public void setEvaluationDelayMs(long evaluationDelayMs) {
            this.evaluationDelayMs = evaluationDelayMs;
        }

        public long getDispatchDelayMs() {
            return dispatchDelayMs;
        }

        public void setDispatchDelayMs(long dispatchDelayMs) {
            this.dispatchDelayMs = dispatchDelayMs;
        }
    }
}
