package com.om.api_gateway;

import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

/**
 * Standard error response following RFC 7807 problem details.
 */
public record ErrorResponse(
        String type,
        String title,
        int status,
        String detail,
        Instant timestamp
) {
    public static ErrorResponse of(HttpStatusCode status, String detail) {
        HttpStatus resolved = status instanceof HttpStatus httpStatus
                ? httpStatus
                : HttpStatus.resolve(status.value());
        String title = resolved != null ? resolved.getReasonPhrase() : "HTTP " + status.value();
        return new ErrorResponse("about:blank", title, status.value(), detail, Instant.now());
    }
}
