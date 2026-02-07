package com.om.Real_Time_Communication.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.om.Real_Time_Communication.dto.*;
import com.om.Real_Time_Communication.models.*;
import com.om.Real_Time_Communication.service.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Map;


@Controller
public class MessageController {
    @Autowired
    private MessageService messageService;
    @Autowired
    private SimpMessagingTemplate messagingTemplate;
    @Autowired
    private OrderedMessageService orderedMessageService;
    @Autowired
    @Qualifier("messageTaskExecutor")
    private TaskExecutor messageTaskExecutor;

    private static final Logger log = LoggerFactory.getLogger(MessageController.class);
    /**
     * Unified persistent message path.
     * Works for both 1:1 (room with two members) and group rooms.
     *
     * Client SEND to: /app/rooms.{roomId}.send
     * Server BROADCAST to: /topic/room.{roomId}
     */
    @MessageMapping({"/rooms/{roomId}/send", "/rooms.{roomId}.send"})
    public void sendToRoom(@DestinationVariable String roomId,
                           @Payload ChatSendDto dto,
                           Principal principal,
                           @Header(name = "correlation-id", required = false) String corrId) {

        Long senderId = Long.valueOf(principal.getName());

         try {
            log.info("[RTC][SEND] /rooms/{}/send by user={} corrId={} type={} metadata={}",
                    roomId,
                    senderId,
                    corrId,
                    dto.getType(),
                    dto.getBody());
            // Persist, ACK to sender and broadcast to room in FIFO order
            orderedMessageService.saveAndBroadcastOrdered(roomId, senderId, dto);
            log.info("[RTC][SEND][OK] roomId={} sender={} messageId={}", roomId, senderId, dto.getMessageId());
        } catch (Exception e) {
            log.error("[RTC][SEND][FAIL] roomId={} sender={} messageId={} err={}", roomId, senderId, dto.getMessageId(), e.getMessage(), e);
            throw new RuntimeException(e);
        }
    }

    /**
     * Ephemeral typing indicator to a specific user’s queue (non-persistent).
     * Keep private destinations ONLY for lightweight, non-history signals.
     *
     * Client SEND to: /app/dm.{userId}.typing  (payload optional)
     * Server SEND-TO-USER: /user/{userId}/queue/typing
     */
    @MessageMapping("/dm/{userId}/typing")
    public void typingToUser(@DestinationVariable Long userId,
                             Principal principal) {
        Long senderId = Long.valueOf(principal.getName());
        log.info("[RTC][TYPING] /dm/{}/typing from sender={} -> user={} ", userId, senderId, userId);
        // Minimal payload – clients can show "senderId is typing..."
        messagingTemplate.convertAndSendToUser(
                String.valueOf(userId),
                "/queue/typing",
                Map.of("senderId", senderId, "type", "typing")
        );
        log.info("[RTC][TYPING][OK] sent typing signal from sender={} to user={}", senderId, userId);
    }

    /**
     * Ephemeral read receipt to a specific user (non-persistent).
     *
     * Client SEND to: /app/dm.{userId}.read  with {roomId, messageId}
     * Server SEND-TO-USER: /user/{userId}/queue/receipts
     */
    @MessageMapping("/dm/{userId}/read")
    public void readReceiptToUser(@DestinationVariable Long userId,
                                  @Payload Map<String, Object> receipt,
                                  Principal principal) {
        Long senderId = Long.valueOf(principal.getName());
        log.info("[RTC][READ] /dm/{}/read sender={} -> user={} roomId={} messageId={}",
                userId,
                senderId,
                userId,
                receipt.get("roomId"),
                receipt.get("messageId"));
        messagingTemplate.convertAndSendToUser(
                String.valueOf(userId),
                "/queue/receipts",
                Map.of(
                        "senderId", senderId,
                        "type", "read",
                        "roomId", receipt.get("roomId"),
                        "messageId", receipt.get("messageId")
                )
        );
        log.info("[RTC][READ][OK] delivered read receipt from sender={} to user={} roomId={} messageId={}",
                senderId,
                userId,
                receipt.get("roomId"),
                receipt.get("messageId"));
    }

    @MessageMapping("/messages/{messageId}/delete-for-me")
    public void deleteForMe(@DestinationVariable String messageId, Principal principal) {
        messageService.deleteMessageForMe(messageId, principal.getName());
    }

    @MessageMapping("/messages/{messageId}/delete-for-everyone")
    public void deleteForEveryone(@DestinationVariable String messageId, Principal principal) {
        messageService.deleteMessageForEveryone(messageId, principal.getName());
    }

    public String extractRoomIdFromMetadata(String metadata) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode node = mapper.readTree(metadata);
            return node.get("roomId").asText();
        } catch (Exception e) {
            throw new RuntimeException("Invalid metadata format: " + metadata);
        }
    }
}
