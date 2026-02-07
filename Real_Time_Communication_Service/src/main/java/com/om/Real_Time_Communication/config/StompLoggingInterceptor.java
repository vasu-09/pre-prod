package com.om.Real_Time_Communication.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.AbstractMessageChannel;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Lightweight debug logger for inbound STOMP frames so we can see whether
 * messages reach the broker pipeline (CONNECT, SUBSCRIBE, SEND).
 */
@Component
public class StompLoggingInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(StompLoggingInterceptor.class);

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor acc = StompHeaderAccessor.wrap(message);
        if (acc == null || acc.getCommand() == null) {
            return message;
        }

        String sessionId = acc.getSessionId();
        String user = acc.getUser() != null ? acc.getUser().getName() : "anon";
        StompCommand cmd = acc.getCommand();
        String dest = acc.getDestination();
        String preview = extractPreview(message.getPayload());
        int size = payloadSize(message.getPayload());
        String direction = resolveDirection(channel);

        log.info("[STOMP][{}] sid={} user={} cmd={} dest={} size={}B preview={} headers={}",
                direction,
                sessionId,
                user,
                cmd,
                dest,
                size,
                preview,
                acc.toNativeHeaderMap());
        return message;
    }

    private String resolveDirection(MessageChannel channel) {
        if (channel instanceof AbstractMessageChannel amc) {
            String name = amc.getBeanName();
            if (name != null) {
                if (name.toLowerCase().contains("outbound")) {
                    return "OUTBOUND";
                }
                if (name.toLowerCase().contains("inbound")) {
                    return "INBOUND";
                }
                return name;
            }
        }
        return "UNKNOWN";
    }


    private int payloadSize(Object payload) {
        if (payload instanceof byte[] bytes) {
            return bytes.length;
        }
        if (payload instanceof String str) {
            return str.getBytes(StandardCharsets.UTF_8).length;
        }
        return 0;
    }

    private String extractPreview(Object payload) {
        String raw;
        if (payload instanceof byte[] bytes) {
            raw = new String(bytes, StandardCharsets.UTF_8);
        } else if (payload instanceof String str) {
            raw = str;
        } else {
            return null;
        }
        String cleaned = raw.replaceAll("\\s+", " ").trim();
        if (cleaned.length() > 200) {
            return cleaned.substring(0, 200) + "…";
        }
        return cleaned;
    }
}
