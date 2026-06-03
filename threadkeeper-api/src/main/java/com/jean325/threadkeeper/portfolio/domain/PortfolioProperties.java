package com.jean325.threadkeeper.portfolio.domain;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "threadkeeper.portfolio")
public class PortfolioProperties {

    private boolean enabled = false;
    private String jsonPath = "";
    private long staleMaxDays = 14;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getJsonPath() {
        return jsonPath;
    }

    public void setJsonPath(String jsonPath) {
        this.jsonPath = jsonPath;
    }

    public long getStaleMaxDays() {
        return staleMaxDays;
    }

    public void setStaleMaxDays(long staleMaxDays) {
        this.staleMaxDays = staleMaxDays;
    }
}
