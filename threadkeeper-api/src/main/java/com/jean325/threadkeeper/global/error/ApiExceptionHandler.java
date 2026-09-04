package com.jean325.threadkeeper.global.error;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApiException(ApiException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(new ApiErrorResponse(ex.getCode(), ex.getMessage(), List.of()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidationException(MethodArgumentNotValidException ex) {
        List<ApiErrorResponse.FieldErrorDetail> fieldErrors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(this::toFieldErrorDetail)
                .toList();

        return ResponseEntity.badRequest()
                .body(new ApiErrorResponse("VALIDATION_ERROR", "The request contains invalid fields.", fieldErrors));
    }

    /**
     * A query parameter that will not convert -- typically an unknown enum
     * constant on a search filter. Without this it falls through to Spring's
     * default body, which the web client cannot describe to the user.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        ApiErrorResponse.FieldErrorDetail detail =
                new ApiErrorResponse.FieldErrorDetail(ex.getName(), describeAccepted(ex));

        return ResponseEntity.badRequest()
                .body(new ApiErrorResponse(
                        "INVALID_PARAMETER",
                        "The request contains an invalid parameter.",
                        List.of(detail)));
    }

    /** Names the accepted values when the target is an enum, since that is the fix. */
    private String describeAccepted(MethodArgumentTypeMismatchException ex) {
        Class<?> required = ex.getRequiredType();
        if (required != null && required.isEnum()) {
            String allowed = Arrays.stream(required.getEnumConstants())
                    .map(String::valueOf)
                    .collect(Collectors.joining(", "));
            return "must be one of: " + allowed;
        }
        return "has the wrong type";
    }

    private ApiErrorResponse.FieldErrorDetail toFieldErrorDetail(FieldError fieldError) {
        String reason = fieldError.getDefaultMessage() == null ? "Invalid value" : fieldError.getDefaultMessage();
        return new ApiErrorResponse.FieldErrorDetail(fieldError.getField(), reason);
    }
}
