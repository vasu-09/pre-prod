package com.om.Real_Time_Communication.config;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/** Caps inbound payload size and applies simple sliding-window rate limits. */
@Component
@RequiredArgsConstructor
public class InboundSizeAndRateInterceptor implements ChannelInterceptor {
    private static final Logger log = LoggerFactory.getLogger(InboundSizeAndRateInterceptor.class);
    private static final int MAX_PAYLOAD_BYTES = 64 * 1024; // 64KB cap

    private final SlidingWindowRateLimiter limiter;

    @Override
    public Message<?> preSend(Message<?> msg, MessageChannel ch) {
        StompHeaderAccessor acc = StompHeaderAccessor.wrap(msg);
        if (acc == null || acc.getCommand() == null) return msg;

        // 1) Size cap
        Object payload = msg.getPayload();
        int size = 0;
        if (payload instanceof byte[]) size = ((byte[]) payload).length;
        else if (payload instanceof String) size = ((String) payload).getBytes(StandardCharsets.UTF_8).length;
        if (size > MAX_PAYLOAD_BYTES) {
            throw new IllegalArgumentException("Payload too large: " + size + " bytes");
        }

        // 2) Rate limits
        String user = acc.getUser() != null ? acc.getUser().getName() : "anon";
        StompCommand cmd = acc.getCommand();

        if (StompCommand.CONNECT.equals(cmd)) {
            // Prefer per-user throttling to avoid collapsing all clients into a shared bucket.
            String connectScope = "anon".equals(user)
                    ? "ip:" + resolveClientIp(acc)
                    : "u:" + user;
            limiter.checkOrThrow(connectScope + ":connect", 50, 10_000);
        } else if (StompCommand.SUBSCRIBE.equals(cmd)) {
             // Allow startup/navigation bursts; scope per session to avoid reconnect penalties.
            String sid = acc.getSessionId() != null ? acc.getSessionId() : "nosid";
            try {
                limiter.checkOrThrow("u:" + user + ":sid:" + sid + ":joins", 50, 10_000);
            } catch (IllegalArgumentException e) {
                log.warn("[WS-RATE] user={} sid={} cmd=SUBSCRIBE dest={} err={}",
                        user, sid, acc.getDestination(), e.getMessage());
                throw e;
            }
        } else if (StompCommand.SEND.equals(cmd)) {
            // 50 msgs / 5s per (user, room) + 200 msgs / 5s global per user
            String dest = acc.getDestination();        // e.g., /app/room/123/send
            String roomId = parseRoomId(dest);
            limiter.checkOrThrow("u:" + user + ":r:" + roomId + ":send", 50, 5_000);
            limiter.checkOrThrow("u:" + user + ":send", 200, 5_000);
        }
        return msg;
    }

    private static String resolveClientIp(StompHeaderAccessor acc) {
        if (acc.getSessionAttributes() == null) return "unknown";
        Object clientIp = acc.getSessionAttributes().get("clientIp");
        return clientIp == null ? "unknown" : clientIp.toString();
    }
    
    private static String parseRoomId(String dest) {
        if (dest == null) return "-1";
        String prefix = "/app/rooms/";
        if (dest.startsWith(prefix)) {
            int end = dest.indexOf('/', prefix.length());
            if (end > 0) {
                return dest.substring(prefix.length(), end);
            }
        }
        return "-1";
    }
}