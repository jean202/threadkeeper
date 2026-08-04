package com.jean325.threadkeeper.drift.domain;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "threadkeeper.drift")
public class DriftProperties {

    /** When false, drift is never recomputed and stored statuses stay as they are. */
    private boolean enabled = true;

    /** Drift score (0-100) at or above which a thread is marked DRIFTING. */
    private int threshold = 60;

    /** How many recent snapshots count as "current activity". */
    private int recentSnapshots = 3;

    /** How many recently imported sessions count as "current activity". */
    private int recentSessions = 5;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getThreshold() {
        return threshold;
    }

    public void setThreshold(int threshold) {
        this.threshold = threshold;
    }

    public int getRecentSnapshots() {
        return recentSnapshots;
    }

    public void setRecentSnapshots(int recentSnapshots) {
        this.recentSnapshots = recentSnapshots;
    }

    public int getRecentSessions() {
        return recentSessions;
    }

    public void setRecentSessions(int recentSessions) {
        this.recentSessions = recentSessions;
    }
}
