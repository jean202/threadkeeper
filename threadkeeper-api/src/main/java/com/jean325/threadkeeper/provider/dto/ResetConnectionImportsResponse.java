package com.jean325.threadkeeper.provider.dto;

public record ResetConnectionImportsResponse(
        long threadsDeleted,
        long sourceSessionsDeleted,
        long snapshotsDeleted
) {}
