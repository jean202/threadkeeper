package com.jean325.threadkeeper.handoff.dto;

import com.jean325.threadkeeper.handoff.domain.HandoffStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateHandoffStatusRequest(
        @NotNull HandoffStatus status
) {
}
