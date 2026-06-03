package com.jean325.threadkeeper.provider.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "threadkeeper.import-scheduler")
public class ImportSchedulerProperties {

    private boolean enabled = false;
    private long connectionId = 1;
    private String target = "codex,claude";
    private String migratorPath = "";
    private String bridgePath = "";
    private String profile = "full";
    private boolean includeSensitive = false;
    private long checkDelayMs = 3_600_000L;
    private long stalenessThresholdHours = 20;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public long getConnectionId() {
        return connectionId;
    }

    public void setConnectionId(long connectionId) {
        this.connectionId = connectionId;
    }

    public String getTarget() {
        return target;
    }

    public void setTarget(String target) {
        this.target = target;
    }

    public String getMigratorPath() {
        return migratorPath;
    }

    public void setMigratorPath(String migratorPath) {
        this.migratorPath = migratorPath;
    }

    public String getBridgePath() {
        return bridgePath;
    }

    public void setBridgePath(String bridgePath) {
        this.bridgePath = bridgePath;
    }

    public String getProfile() {
        return profile;
    }

    public void setProfile(String profile) {
        this.profile = profile;
    }

    public boolean isIncludeSensitive() {
        return includeSensitive;
    }

    public void setIncludeSensitive(boolean includeSensitive) {
        this.includeSensitive = includeSensitive;
    }

    public long getCheckDelayMs() {
        return checkDelayMs;
    }

    public void setCheckDelayMs(long checkDelayMs) {
        this.checkDelayMs = checkDelayMs;
    }

    public long getStalenessThresholdHours() {
        return stalenessThresholdHours;
    }

    public void setStalenessThresholdHours(long stalenessThresholdHours) {
        this.stalenessThresholdHours = stalenessThresholdHours;
    }
}
