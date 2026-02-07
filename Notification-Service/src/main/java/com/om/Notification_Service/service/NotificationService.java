package com.om.Notification_Service.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.om.Notification_Service.client.ChatMessageService;
import com.om.Notification_Service.client.ChatRoomService;
import com.om.Notification_Service.client.UserService;
import com.om.Notification_Service.dto.*;
import com.om.Notification_Service.models.Notification;
import com.om.Notification_Service.repository.NotificationRepository;
import io.micrometer.core.annotation.Timed;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class NotificationService {

    @Autowired
    private  NotificationRepository repo;
    @Autowired
    private  EmailSender emailSender;
    @Autowired
    private  PushSender pushSender;

    @Autowired private ChatRoomService chatRoomService;
    @Autowired private ChatMessageService messageService;
    @Autowired private UserService userService;

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    @EventListener
    public void handleRecipientsAdded(RecipientsAddedToListEvent evt) {
        log.info("Received RecipientsAddedToListEvent: listId={}, creatorUserId={}, newUserIds={}",
                evt.getListId(), evt.getCreatorUserId(), evt.getNewUserIds());
        String creatorName = userService.findById(String.valueOf(evt.getCreatorUserId())).getDisplayName();
        String template = "%s added you to the To-Do list “%s”.";

        for (Long recipientId : evt.getNewUserIds()) {
            // 1) get or create the 1:1 room
            ChatRoomDto room = chatRoomService.getOrCreateDirectRoom(evt.getCreatorUserId(), recipientId);

            // 2) build a system message
            ChatMessageDto sysMsg = ChatMessageDto.builder()
                    .roomId(Long.valueOf(room.getId()))
                    .senderId(evt.getCreatorUserId())
                    .type(MessageType.SYSTEM)
                    .content(String.format(template, creatorName, evt.getListName()))
                    .timestamp(Instant.now())
                    .build();

            // 3) persist & broadcast over WebSocket
            messageService.save(sysMsg);
            messageService.broadcast(sysMsg);
        }
    }

    @Timed(value = "notifications.handle", histogram = true)
    public void handleEvent(EventMessage event) {
        log.info("Handling event of type {} for user {} with recipients {}", event.getType(), event.getUserId(), event.getRecipientIds());
        List<Long> recipients = event.getRecipientIds();
        if (recipients == null || recipients.isEmpty()) {
            if (event.getUserId() != null) {
                recipients = List.of(event.getUserId());
            } else {
                return; // nothing to do
            }
        }

        for (Long recipientId : recipients) {
            Notification n = new Notification();
            n.setExternalEventId(event.getData() != null ? String.valueOf(event.getData().get("eventId")) : null);
            n.setSource(event.getType());
            n.setUserId(recipientId);
            n.setType(event.getType());
            n.setPayload(json(event.getData()));
            repo.save(n);

            pushSender.sendPush(event, recipientId);
        }
    }

    private String json(Object obj) {
        try {
            return new ObjectMapper().writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize payload", e);
        }
    }
    // Fetch all notifications for a user
    public Page<Notification> listNotifications(Long userId, Pageable pageable) {
        return repo.findByUserIdOrderByCreatedAtDesc(userId, pageable);
    }

    // Mark a specific notification as read
    public void markAsRead(Long id) {
        Optional<Notification> optional = repo.findById(id);
        optional.ifPresent(notification -> {
            notification.setRead(true);
            repo.save(notification);
        });
    }
    @EventListener
    public void handleListNameChanged(ListNameChangedEvent evt) {
        log.info("Received ListNameChangedEvent: listId={}, creatorUserId={}, oldName={}, newName={}",
                evt.getListId(), evt.getCreatorUserId(), evt.getOldName(), evt.getNewName());
        String creatorName = userService.findById(String.valueOf(evt.getCreatorUserId())).getDisplayName();
        String template = "%s changed the list name from \"%s\" to \"%s\".";

        for (Long recipientId : evt.getRecipientUserIds()) {
            ChatRoomDto room = chatRoomService.getOrCreateDirectRoom(evt.getCreatorUserId(), recipientId);

            ChatMessageDto sysMsg = ChatMessageDto.builder()
                    .roomId(Long.valueOf(room.getId()))
                    .senderId(evt.getCreatorUserId())
                    .type(MessageType.SYSTEM)
                    .content(String.format(template, creatorName, evt.getOldName(), evt.getNewName()))
                    .timestamp(Instant.now())
                    .build();

            messageService.save(sysMsg);
            messageService.broadcast(sysMsg);
        }
    }

    @EventListener
    public void handleListDeleted(ListDeletedEvent evt) {
        log.info("Received ListDeletedEvent: listId={}, creatorUserId={}, listName={}",
                evt.getListId(), evt.getCreatorUserId(), evt.getListName());
        String creatorName = userService.findById(String.valueOf(evt.getCreatorUserId())).getDisplayName();
        String template = "%s has deleted the list \"%s\".";

        for (Long recipientId : evt.getRecipientUserIds()) {
            ChatRoomDto room = chatRoomService.getOrCreateDirectRoom(evt.getCreatorUserId(), recipientId);

            ChatMessageDto sysMsg = ChatMessageDto.builder()
                    .roomId(Long.valueOf(room.getId()))
                    .senderId(evt.getCreatorUserId())
                    .type(MessageType.SYSTEM)
                    .content(String.format(template, creatorName, evt.getListName()))
                    .timestamp(Instant.now())
                    .build();

            messageService.save(sysMsg);
            messageService.broadcast(sysMsg);
        }
    }
}

