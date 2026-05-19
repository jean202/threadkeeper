package com.jean325.threadkeeper.thread.dto;

import com.jean325.threadkeeper.thread.domain.ThreadStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateThreadStatusRequest(
        @NotNull ThreadStatus status
) {
}
