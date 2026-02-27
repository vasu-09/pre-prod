package com.om.Real_Time_Communication.service;

import com.om.Real_Time_Communication.Repository.ChatRoomRepository;
import com.om.Real_Time_Communication.dto.AckDto;
import com.om.Real_Time_Communication.dto.ChatSendDto;
import com.om.Real_Time_Communication.models.ChatMessage;
import com.om.Real_Time_Communication.models.ChatRoom;
import com.om.Real_Time_Communication.presence.PerRoomDispatcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Map;

@Service

public class OrderedMessageService {
    private static final Logger log = LoggerFactory.getLogger(OrderedMessageService.class);
    private final PerRoomDispatcher dispatcher;
    private final MessageService messageService; // existing service doing DB + fanout
    private final SimpMessagingTemplate messagingTemplate;
    private final ChatRoomRepository chatRoomRepository;
    private final RoomMembershipService membershipService;
    private final InboxDeliveryService inboxDeliveryService;

    public OrderedMessageService(
            PerRoomDispatcher dispatcher,
            MessageService messageService,
            SimpMessagingTemplate messagingTemplate,
            ChatRoomRepository chatRoomRepository,
            RoomMembershipService membershipService,
            InboxDeliveryService inboxDeliveryService
    ) {
        this.dispatcher = dispatcher;
        this.messageService = messageService;
        this.messagingTemplate = messagingTemplate;
        this.chatRoomRepository = chatRoomRepository;
        this.membershipService = membershipService;
        this.inboxDeliveryService = inboxDeliveryService;
    }

    /**
     * Strict FIFO: persist then ACK the sender and broadcast to the room in order.
     * Runs the work on a per-room executor to preserve message ordering.
     */
    public void saveAndBroadcastOrdered(String roomId, Long senderId, ChatSendDto dto) throws Exception {
        log.info("Received message {} for room {} from sender {}", dto.getMessageId(), roomId, senderId);
        ChatRoom room = chatRoomRepository.findByRoomId(roomId)
                .orElseGet(() -> tryResolveByNumericId(roomId));

        if (room == null) {
            throw new IllegalArgumentException("Room not found: " + roomId);
        }
        Long internalId = room.getId();
        dispatcher.executeAndWait(internalId, () -> {
            // Keep the real work transactional

            ChatMessage saved = messageService.saveInbound(internalId, senderId, dto);
            log.info("Persisted message {} for room {}", saved.getMessageId(), roomId);
            messagingTemplate.convertAndSendToUser(
                    String.valueOf(senderId),
                    "/queue/ack",
                    new AckDto(roomId, saved.getMessageId(), saved.getServerTs())
            );
            log.info("Acknowledged message {} to sender {}", saved.getMessageId(), senderId);

            // Broadcast the message event to the room topic for other subscribers
            Map<String, Object> event = messageService.toRoomEvent(saved);
            messagingTemplate.convertAndSend("/topic/room." + roomId, event);
            log.info("Broadcasted message {} to room {}", saved.getMessageId(), roomId);

            List<Long> members = membershipService.memberIds(internalId);

            inboxDeliveryService.recordAndDispatch(room, saved, event, members);

            return null; // required by Callable
        });
    }

    private ChatRoom tryResolveByNumericId(String roomId) {
        try {
            Long numericId = Long.valueOf(roomId);
            return chatRoomRepository.findById(numericId).orElse(null);
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
