package com.jean325.threadkeeper.provider.dto;

import jakarta.validation.constraints.Size;
import java.util.Arrays;
import java.util.Set;

/**
 * @param migratorPath only needed for targets the bridge cannot read on its own;
 *                     Codex and Claude sessions are read from disk directly, so it
 *                     may be left blank when those are the only targets.
 */
public record RunProviderImportRequest(
        @Size(max = 500) String migratorPath,
        @Size(max = 500) String bridgePath,
        @NotBlankOrNull String profile,
        @NotBlankOrNull String target,
        boolean includeSensitive
) {

    /** The bridge's default when no target is given. */
    public static final String DEFAULT_TARGET = "codex,claude";

    /** Targets the bridge reads straight from disk -- mirrors DIRECT_TARGETS in the bridge. */
    private static final Set<String> DIRECT_TARGETS = Set.of("codex", "claude");

    public String targetOrDefault() {
        return target == null ? DEFAULT_TARGET : target;
    }

    /** Whether any requested target has to go through agent-state-migrator. */
    public boolean needsMigrator() {
        return Arrays.stream(targetOrDefault().split(","))
                .map(String::trim)
                .filter(t -> !t.isEmpty())
                .anyMatch(t -> !DIRECT_TARGETS.contains(t));
    }

    public boolean hasMigratorPath() {
        return migratorPath != null && !migratorPath.isBlank();
    }
}
