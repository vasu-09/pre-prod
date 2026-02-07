package com.om.Real_Time_Communication.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Simple in-memory store to track messages that could not be delivered to a
 * WebSocket session. This allows operators to inspect which messages were
 * dropped due to abrupt disconnects and can later be persisted or retried.
 */
@Component
public class UndeliveredMessageStore {
    private static final Logger log = LoggerFactory.getLogger(UndeliveredMessageStore.class);

    private final ConcurrentMap<Long, List<String>> undelivered = new ConcurrentHashMap<>();

    public void record(Long userId, String messageId, Exception ex) {
        undelivered.computeIfAbsent(userId, k -> Collections.synchronizedList(new ArrayList<>()))
                .add(messageId);
        log.warn("Buffered undelivered message {} for user {}: {}", messageId, userId, ex.toString());
    }

    public List<String> getUndelivered(Long userId) {
        return undelivered.getOrDefault(userId, List.of());
    }
}
