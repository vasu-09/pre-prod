package com.om.Real_Time_Communication;

import com.om.Real_Time_Communication.Repository.ChatMessageRepository;
import com.om.Real_Time_Communication.Repository.ChatRoomParticipantRepository;
import com.om.Real_Time_Communication.Repository.ChatRoomRepository;
import com.om.Real_Time_Communication.Repository.MessageRepository;
import com.om.Real_Time_Communication.dto.ChatSendDto;
import com.om.Real_Time_Communication.dto.MessageDto;
import com.om.Real_Time_Communication.models.ChatMessage;
import com.om.Real_Time_Communication.models.*;
import com.om.Real_Time_Communication.security.SessionRegistry;
import com.om.Real_Time_Communication.service.*;
import com.om.Real_Time_Communication.service.MessageService.DirectRoomPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.socket.WebSocketSession;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MessageServiceTest {

    @Mock MessageRepository messageRepository;
    @Mock BlockService blockService;
    @Mock EventPublisher eventPublisher;
    @Mock SimpMessagingTemplate messagingTemplate;
    @Mock SessionRegistry sessionRegistry;

    // Dependencies for saveInbound
    @Mock ChatMessageRepository chatMessageRepository;
    @Mock ChatRoomParticipantRepository chatRoomParticipantRepository;
    @Mock ChatRoomRepository chatRoomRepository;
    @Mock ChatRoomService aclService;
    @Mock DirectRoomPolicy directPolicy;
    @Mock RoomMembershipService membership;
    @Mock UndeliveredMessageStore undeliveredStore;
    @Mock InboxDeliveryService inboxDeliveryService;

    @InjectMocks
    MessageService service;

    @BeforeEach
    void setup() {
        lenient().when(blockService.isBlocked(anyString(), anyString())).thenReturn(false);
    }

    @Test
    void handlePrivateMessage_sendsToOnlineUser() throws Exception {
        when(messageRepository.findByMessageId("m1")).thenReturn(Optional.empty());
        Message saved = new Message();
        saved.setId(1L);
        saved.setSenderId("1");
        saved.setReceiverId("2");
        saved.setContent("hi");
        saved.setMessageId("m1");
        saved.setTimestamp(LocalDateTime.now());
        when(messageRepository.save(any())).thenReturn(saved);
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-1");
        when(sessionRegistry.getSessions(2L)).thenReturn(Set.of(session));

        MessageDto dto = new MessageDto();
        dto.setSenderId("1");
        dto.setReceiverId("2");
        dto.setContent("hi");
        dto.setType(MessageType.TEXT);
        dto.setMessageId("m1");

        MessageDto result = service.handlePrivateMessage(dto);
        assertEquals("m1", result.getMessageId());

        verify(messagingTemplate).convertAndSendToUser(eq("2"), anyString(), eq(dto), any(Map.class));
        verify(messagingTemplate).convertAndSendToUser(eq("1"), anyString(), eq(dto));
        verify(eventPublisher).publish(any());
    }

    @Test
    void handlePrivateMessage_publishesOfflineWhenUserOffline() throws Exception {
        when(messageRepository.findByMessageId("m2")).thenReturn(Optional.empty());
        Message saved = new Message();
        saved.setId(2L);
        saved.setSenderId("1");
        saved.setReceiverId("3");
        saved.setContent("yo");
        saved.setMessageId("m2");
        saved.setTimestamp(LocalDateTime.now());
        when(messageRepository.save(any())).thenReturn(saved);
        when(sessionRegistry.getSessions(3L)).thenReturn(Set.of());

        MessageDto dto = new MessageDto();
        dto.setSenderId("1");
        dto.setReceiverId("3");
        dto.setContent("yo");
        dto.setType(MessageType.TEXT);
        dto.setMessageId("m2");

        service.handlePrivateMessage(dto);

        verify(eventPublisher).publish(any());
        verify(undeliveredStore).record(eq(3L), anyString(), any());
        verify(messagingTemplate).convertAndSendToUser(eq("1"), anyString(), eq(dto));
        verify(messagingTemplate, never()).convertAndSendToUser(eq("3"), anyString(), eq(dto), any(Map.class));
    }

    @Test
    void handlePrivateMessage_doesNotDuplicate() throws Exception {
        Message existing = new Message();
        existing.setMessageId("m3");
        when(messageRepository.findByMessageId("m3")).thenReturn(Optional.of(existing));

        MessageDto dto = new MessageDto();
        dto.setSenderId("1");
        dto.setReceiverId("2");
        dto.setContent("dup");
        dto.setType(MessageType.TEXT);
        dto.setMessageId("m3");

        service.handlePrivateMessage(dto);

        verify(messageRepository, never()).save(any());
        verify(messagingTemplate, never()).convertAndSendToUser(anyString(), anyString(), any());
        verify(eventPublisher, never()).publishOfflineMessage(anyString(), any());
    }

    @Test
    void deleteConversationForUser_marksMessagesAndHidesRoom() {
        Message m1 = new Message();
        m1.setSenderId("1");
        m1.setReceiverId("2");
        Message m2 = new Message();
        m2.setSenderId("2");
        m2.setReceiverId("1");
        when(messageRepository.findConversationBetween("1", "2")).thenReturn(List.of(m1, m2));

        ChatRoom room = new ChatRoom();
        room.setType(ChatRoomType.DIRECT);
        ChatRoomParticipant participant = new ChatRoomParticipant();
        participant.setHidden(false);

        String pairKey = ChatRoomRepository.buildDirectPairKey(1L, 2L);
        when(chatRoomRepository.findByDirectPairKeyAndType(pairKey, ChatRoomType.DIRECT)).thenReturn(Optional.of(room));
        when(chatRoomParticipantRepository.findByUserIdAndChatRoom(1L, room)).thenReturn(Optional.of(participant));

        service.deleteConversationForUser("1", "2");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Message>> captor = ArgumentCaptor.forClass(List.class);
        verify(messageRepository).saveAll(captor.capture());
        List<Message> savedMessages = captor.getValue();
        assertEquals(2, savedMessages.size());
        assertTrue(savedMessages.stream().allMatch(m -> m.getDeletedByUserIds().contains("1")));
        assertTrue(savedMessages.stream().allMatch(m -> m.isDeletedBySender() || m.isDeletedByReceiver()));
        assertTrue(m1.isDeletedBySender());
        assertTrue(m2.isDeletedByReceiver());

        assertTrue(participant.isHidden());
        assertNotNull(participant.getHiddenAt());
        verify(chatRoomParticipantRepository).save(participant);
        verify(membership).evictUserRooms(1L);
    }

    @Test
    void saveInbound_publishesToRecipients() {
        ChatSendDto dto = new ChatSendDto();
        dto.setMessageId("g1");
        dto.setType(MessageType.TEXT);
        dto.setE2ee(true);
        dto.setAlgo("AES-GCM");
        dto.setKeyRef("k1");
        dto.setIv(new byte[] {1, 2, 3});
        dto.setCiphertext(new byte[] {4, 5, 6});

        ChatMessage saved = new ChatMessage();
        saved.setMessageId("g1");
        saved.setRoomId(10L);
        saved.setSenderId(1L);
        saved.setServerTs(Instant.now());
        saved.setType(MessageType.TEXT);
        saved.setE2ee(true);
        when(chatMessageRepository.findByRoomIdAndMessageId(10L, "g1")).thenReturn(Optional.empty());
        when(chatMessageRepository.save(any())).thenReturn(saved);
        when(aclService.canPublish(1L, Long.valueOf("10"))).thenReturn(true);
        when(directPolicy.isDirect(10L)).thenReturn(false);
        when(membership.memberIds(10L)).thenReturn(List.of(1L,2L,3L));

        service.saveInbound(10L, 1L, dto);

        ArgumentCaptor<List<Long>> captor = ArgumentCaptor.forClass(List.class);
        verify(eventPublisher).publishNewMessage(eq(10L), eq("g1"), eq(1L), captor.capture(), eq(true), isNull());
        verify(inboxDeliveryService).sendInboxEvent(saved);
        assertEquals(List.of(2L,3L), captor.getValue());
    }
}

