package com.om.Real_Time_Communication.controller;

import com.om.Real_Time_Communication.service.InboxDeliveryService;
import lombok.Data;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
public class InboxController {

    private static final Logger log = LoggerFactory.getLogger(InboxController.class);
    private final InboxDeliveryService inboxDeliveryService;

    public InboxController(InboxDeliveryService inboxDeliveryService) {
        this.inboxDeliveryService = inboxDeliveryService;
    }

    @MessageMapping("/inbox/ack")
    public void ack(InboxAck ack, Principal principal) {
        if (principal == null || ack == null || ack.getMsgId() == null) {
            return;
        }
        Long userId = Long.valueOf(principal.getName());
        log.info("[INBOX][ACK] user={} msgId={} status={} deviceId={}", userId, ack.getMsgId(), ack.getStatus(), ack.getDeviceId());
        boolean read = "READ".equalsIgnoreCase(ack.getStatus());
        inboxDeliveryService.markDelivered(ack.getMsgId(), userId, ack.getDeviceId(), read);
    }

    @Data
    public static class InboxAck {
        private String msgId;
        private String roomKey;
        private String status;
        private String deviceId;
    }
}
