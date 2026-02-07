package com.om.Real_Time_Communication.config;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/** Per-session outbound backpressure guard with low-priority drop. */
@Component
public class OutboundFloodGuardInterceptor implements ChannelInterceptor {
    private static final int MAX_INFLIGHT = 1000; // permits per session (tune 200–2000)
    private static final Pattern LOW_PRIORITY =
            Pattern.compile("^/topic/(typing|presence|heartbeat)(\\.|/).*");

    private final ConcurrentMap<String, Semaphore> permits = new ConcurrentHashMap<>();

    @Override
    public Message<?> preSend(Message<?> msg, MessageChannel ch) {
        SimpMessageHeaderAccessor acc = SimpMessageHeaderAccessor.wrap(msg);
        if (acc == null) return msg;
        String sessionId = acc.getSessionId();
        if (sessionId == null) return msg;

        String dest = acc.getDestination();
        Semaphore sem = permits.computeIfAbsent(sessionId, k -> new Semaphore(MAX_INFLIGHT));

        boolean acquired = sem.tryAcquire();
        if (!acquired) {
            // Session congested
            if (dest != null && LOW_PRIORITY.matcher(dest).matches()) {
                return null; // drop low-priority frames
            } else {
                try { acquired = sem.tryAcquire(25, TimeUnit.MILLISECONDS); } catch (InterruptedException ignored) {}
                if (!acquired) return null; // still congested → drop to protect server
            }
        }
        // Mark so we can release after broker send completes
        return MessageBuilder.fromMessage(msg).setHeader("x-release-permit", Boolean.TRUE).build();
    }

    @Override
    public void afterSendCompletion(Message<?> message, MessageChannel channel, boolean sent, Exception ex) {
        SimpMessageHeaderAccessor acc = SimpMessageHeaderAccessor.wrap(message);
        if (acc == null) return;
        String sessionId = acc.getSessionId();
        if (sessionId == null) return;
        Object marker = acc.getHeader("x-release-permit");
        if (Boolean.TRUE.equals(marker)) {
            Semaphore sem = permits.get(sessionId);
            if (sem != null) sem.release();
        }
    }
}
