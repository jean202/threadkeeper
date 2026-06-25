package com.jean325.threadkeeper.portfolio.application;

public record PortfolioScanEntry(
        String name, int readiness, int baseReadiness, String scannedAt, GitActivity gitActivity) {

    /** Back-compat: entries without git activity. */
    public PortfolioScanEntry(String name, int readiness, int baseReadiness, String scannedAt) {
        this(name, readiness, baseReadiness, scannedAt, null);
    }

    public record GitActivity(Integer daysSinceLastCommit, Boolean active, String lastCommitDate) {}
}
