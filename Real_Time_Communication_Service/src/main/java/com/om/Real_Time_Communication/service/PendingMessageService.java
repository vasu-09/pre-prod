package com.om.Real_Time_Communication.service;

import com.om.Real_Time_Communication.dto.MessageDto;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Simple in-memory queue for messages that have not been acknowledged by the
 * recipient yet. Messages are delivered again when the user reconnects.
 * This provides at-least-once delivery semantics for private messages.
 */
@Service
public class PendingMessageService {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * key: receiverId -> pending messages awaiting ACK
     */
    private final ConcurrentMap<String, List<MessageDto>> pending = new ConcurrentHashMap<>();

    public PendingMessageService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /** Store a message for later delivery/ack tracking. */
    public void store(MessageDto dto) {
        pending.computeIfAbsent(dto.getReceiverId(), k -> new CopyOnWriteArrayList<>()).add(dto);
    }

    /** Remove message from pending list once ACK is received. */
    public void ack(String userId, Long messageId) {
        List<MessageDto> list = pending.get(userId);
        if (list != null) {
            list.removeIf(m -> Objects.equals(m.getId(), messageId));
            if (list.isEmpty()) pending.remove(userId);
        }
    }

    /** Deliver all pending messages to the user (e.g. upon reconnect). */
    public void flush(Long userId) {
        String key = String.valueOf(userId);
        List<MessageDto> list = pending.get(key);
        if (list == null) return;
        for (MessageDto m : list) {
            messagingTemplate.convertAndSendToUser(key, "/queue/private", m);
        }
    }
}
