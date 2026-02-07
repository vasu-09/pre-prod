package com.om.Real_Time_Communication.utility;

import io.micrometer.tracing.Tracer;
import io.micrometer.tracing.Span;
import org.springframework.stereotype.Component;

@Component
public class TraceTags {
    private final Tracer tracer;
    public TraceTags(Tracer tracer){ this.tracer = tracer; }

    public void tagMsg(Long roomId, Long userId, String messageId) {
        Span span = tracer.currentSpan();
        if (span != null) {
            span.tag("room.id", String.valueOf(roomId));
            span.tag("user.id", String.valueOf(userId));
            if (messageId != null) span.tag("msg.id", messageId);
        }
    }
}
