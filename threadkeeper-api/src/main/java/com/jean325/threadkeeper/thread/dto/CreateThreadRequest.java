package com.jean325.threadkeeper.thread.dto;

import com.jean325.threadkeeper.thread.domain.ThreadPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateThreadRequest(
        @NotBlank @Size(max = 100) String projectKey,
        @NotBlank @Size(max = 200) String title,
        @NotNull ThreadPriority priority,
        @NotBlank String originalIntent,
        @Size(max = 2000) String todayGoal,
        @Size(max = 2000) String doneCondition
) {
}
