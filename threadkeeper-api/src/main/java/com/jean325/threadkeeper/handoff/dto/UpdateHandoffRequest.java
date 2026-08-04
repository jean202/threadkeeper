package com.jean325.threadkeeper.handoff.dto;

import com.jean325.threadkeeper.handoff.domain.HandoffStatus;
import com.jean325.threadkeeper.provider.domain.ProviderType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Edits the body of an existing handoff. {@code status} is optional: leave it
 * null to keep the current status, or set it to finalize in the same call that
 * saves the edits.
 */
public record UpdateHandoffRequest(
        @NotNull ProviderType targetProvider,
        @Size(max = 100) String reason,
        String whatChanged,
        String blockers,
        String nextAction,
        String filesNote,
        HandoffStatus status
) {
}
