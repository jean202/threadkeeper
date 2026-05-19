package com.jean325.threadkeeper.snapshot.dto;

import com.jean325.threadkeeper.snapshot.domain.SnapshotType;
import com.jean325.threadkeeper.thread.domain.DriftStatus;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record CreateThreadSnapshotRequest(
        @NotNull SnapshotType snapshotType,
        @NotBlank String summary,
        @Size(max = 2000) String nextAction,
        @Size(max = 2000) String blockers,
        @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal driftScore,
        DriftStatus driftStatus
) {
}
