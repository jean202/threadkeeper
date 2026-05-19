package com.jean325.threadkeeper.global.error;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

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

    private ApiErrorResponse.FieldErrorDetail toFieldErrorDetail(FieldError fieldError) {
        String reason = fieldError.getDefaultMessage() == null ? "Invalid value" : fieldError.getDefaultMessage();
        return new ApiErrorResponse.FieldErrorDetail(fieldError.getField(), reason);
    }
}
