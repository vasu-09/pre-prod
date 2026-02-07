package com.om.Real_Time_Communication.controller;

import com.om.Real_Time_Communication.Repository.ChatMessageRepository;
import com.om.Real_Time_Communication.Repository.ChatRoomParticipantRepository;
import com.om.Real_Time_Communication.service.ChatRoomService;
import com.om.Real_Time_Communication.client.UserServiceClient;
import com.om.Real_Time_Communication.dto.ChatMessageDto;
import com.om.Real_Time_Communication.dto.RecipientsRemovedFromListEvent;
import com.om.Real_Time_Communication.models.*;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;


@Component
public class ListParticipantRemovalListener {

    private final ChatRoomService chatRoomService;
    private final ChatRoomParticipantRepository  partRepo;
    private final ChatMessageRepository          msgRepo;
    private final SimpMessagingTemplate          wsTemplate;
    private final UserServiceClient              userService;

    public ListParticipantRemovalListener(
            ChatRoomService chatRoomService,
            ChatRoomParticipantRepository partRepo,
            ChatMessageRepository msgRepo,
            SimpMessagingTemplate wsTemplate,
            UserServiceClient userService
    ) {
        this.chatRoomService = chatRoomService;
        this.partRepo    = partRepo;
        this.msgRepo     = msgRepo;
        this.wsTemplate  = wsTemplate;
        this.userService = userService;
    }

    @EventListener
    public void handle(RecipientsRemovedFromListEvent evt) {
        Long removerId = evt.getRemoverUserId();
        Long removedId = evt.getRemovedUserId();
        String listName = evt.getListName();

        // 1) Lookup display name
        String removerName = userService
                .getUserById(removerId);
        // 2) Find or create the DIRECT room
        ChatRoom room = chatRoomService.createDirectChat(removerId, removedId);

        // 3) Build & save the SYSTEM message
        String content = String.format(
                "%s removed you from the To-Do list “%s”.",
                removerName, listName
        );
        ChatMessage entity = new ChatMessage();
        entity.setRoomId(room.getId());
        entity.setSenderId(removedId);
        entity.setType(MessageType.SYSYEM);
        entity.setBody(content);
        entity.setE2ee(false);

        ChatMessage savedMsg = msgRepo.save(entity);

        // 4) Broadcast over WebSocket
        ChatMessageDto dto = ChatMessageDto.fromEntity(savedMsg);
        wsTemplate.convertAndSend(
                "/topic/room/" + dto.getRoomId(),
                dto
        );
    }
}
