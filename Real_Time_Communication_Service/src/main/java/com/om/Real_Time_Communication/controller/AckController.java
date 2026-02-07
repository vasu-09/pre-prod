package com.om.Real_Time_Communication.controller;

import com.om.Real_Time_Communication.service.PendingMessageService;
import lombok.Data;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * Controller for handling client ACKs of delivered messages. Clients should
 * send a message to /app/ack with the ID of the message they received. Once
 * acknowledged, the pending copy is removed from the queue.
 */
@Controller
public class AckController {

    private final PendingMessageService pendingMessages;

    public AckController(PendingMessageService pendingMessages) {
        this.pendingMessages = pendingMessages;
    }
    private static final Logger log = LoggerFactory.getLogger(AckController.class);

    @MessageMapping("/ack")
    public void ack(MessageAck ack, Principal principal) {
        if (principal != null && ack != null && ack.getMessageId() != null) {
            log.info("[RTC][ACK] /ack user={} messageId={}", principal.getName(), ack.getMessageId());
            pendingMessages.ack(principal.getName(), ack.getMessageId());
            log.info("[RTC][ACK][OK] cleared pending messageId={} for user={}", ack.getMessageId(), principal.getName());
        }
    }

    @Data
    public static class MessageAck {
        private Long messageId;

        public Long getMessageId() {
            return messageId;
        }

        public void setMessageId(Long messageId) {
            this.messageId = messageId;
        }
    }
}
