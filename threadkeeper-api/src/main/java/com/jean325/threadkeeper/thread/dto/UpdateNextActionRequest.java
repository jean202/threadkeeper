package com.jean325.threadkeeper.thread.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateNextActionRequest(
        @NotBlank @Size(max = 2000) String currentNextAction
) {
}
