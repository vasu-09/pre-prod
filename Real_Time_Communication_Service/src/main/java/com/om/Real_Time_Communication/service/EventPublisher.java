package com.om.Real_Time_Communication.service;

import com.om.Real_Time_Communication.config.RabbitConfig;
import com.om.Real_Time_Communication.dto.EventMessage;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class EventPublisher {

    private final RabbitTemplate rabbitTemplate;

    @Autowired
    public EventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publish(EventMessage message) {
        rabbitTemplate.convertAndSend(
                RabbitConfig.EXCHANGE_EVENTS,
                RabbitConfig. Q_READMODEL_MSG_CREATED,
                message
        );
    }

    public void publishNewMessage(Long roomId,
                                  String messageId,
                                  Long senderId,
                                  java.util.List<Long> recipientIds,
                                  boolean e2ee,
                                  String preview) {
        java.util.Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("type", "MESSAGE_NEW");
        payload.put("roomId", roomId);
        payload.put("messageId", messageId);
        payload.put("senderId", senderId);
        payload.put("e2ee", e2ee);
        if (preview != null) payload.put("preview", preview);
        payload.put("recipients", recipientIds);

        // Example: publish to notifications exchange
        // routing key can be tenant-aware if you have multitenancy
        rabbitTemplate.convertAndSend("rtc.notifications", "notif.message.new", payload);
    }

    /**
     * Notify downstream systems (e.g., push notifications) that a
     * direct message was received for a user who is currently
     * offline.  The payload is intentionally small and contains
     * enough information for a separate service to decide how to
     * alert the user.
     */
    public void publishOfflineMessage(String receiverId, com.om.Real_Time_Communication.dto.MessageDto dto) {
        java.util.Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("type", "OFFLINE_MESSAGE");
        payload.put("receiverId", receiverId);
        payload.put("senderId", dto.getSenderId());
        payload.put("messageId", dto.getMessageId());
        rabbitTemplate.convertAndSend("rtc.notifications", "notif.message.offline", payload);
    }
}

