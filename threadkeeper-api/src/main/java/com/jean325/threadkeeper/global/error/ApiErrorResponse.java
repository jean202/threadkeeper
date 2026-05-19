package com.jean325.threadkeeper.global.error;

import java.util.List;

public record ApiErrorResponse(
        String code,
        String message,
        List<FieldErrorDetail> fieldErrors
) {
    public record FieldErrorDetail(String field, String reason) {
    }
}
