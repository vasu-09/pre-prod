package com.om.Real_Time_Communication.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.om.Real_Time_Communication.Repository.*;
import com.om.Real_Time_Communication.dto.ChatSendDto;
import com.om.Real_Time_Communication.dto.EventMessage;
import com.om.Real_Time_Communication.dto.MessageCreated;
import com.om.Real_Time_Communication.dto.MessageDto;
import com.om.Real_Time_Communication.models.*;
import com.om.Real_Time_Communication.utility.IdValidators;
import com.om.Real_Time_Communication.security.SessionRegistry;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.socket.WebSocketSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.nio.file.AccessDeniedException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MessageService {

    private static final Logger log = LoggerFactory.getLogger(MessageService.class);

    @Autowired
    private  OutboxEventRepository outboxRepo;
    @Autowired
    private  ObjectMapper objectMapper;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private BlockService blockService;

    @Autowired
    private CallRoomRepository callRoomRepository;

    @Autowired
    private EventPublisher eventPublisher;

    @Autowired
    private ChatRoomParticipantRepository chatRoomParticipantRepository;

    @Autowired
    private ChatRoomRepository chatRoomRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;


    @Autowired
    private ChatRoomService aclService;

    @Autowired(required = false)
    private DirectRoomPolicy directPolicy;

    @Autowired
    private RoomMembershipService membership;

    @Autowired
    private SessionRegistry sessionRegistry;

    @Autowired
    private PendingMessageService pendingMessages;

    @Autowired
    private UndeliveredMessageStore undeliveredStore;

    @Autowired
    private InboxDeliveryService inboxDeliveryService;


    @Transactional
    public ChatMessage saveInbound(Long roomId, Long senderId, ChatSendDto dto) {
        // 0) Guard rails
        if (roomId == null) throw new IllegalArgumentException("roomId required");
        if (senderId == null) throw new IllegalArgumentException("senderId required");
        if (dto == null) throw new IllegalArgumentException("payload required");
        if (dto.getMessageId() == null || dto.getMessageId().isBlank())
            throw new IllegalArgumentException("messageId required");
        if (dto.getType() == null)
            throw new IllegalArgumentException("type required");

        // 1) Room ACL: sender must be allowed to publish
        if (aclService != null && !aclService.canPublish(senderId, roomId)) {
            throw new IllegalArgumentException("Forbidden: cannot publish to room " + roomId);
        }

        // 2) 1:1 block policy (optional but recommended)
        if (directPolicy != null && directPolicy.isDirect(roomId)) {
            Long peer = directPolicy.peer(roomId, senderId);
            if (!directPolicy.maySend(senderId, peer)) {
                throw new IllegalArgumentException("Forbidden: sender is blocked");
            }
        }

        // 3) Idempotency: if this messageId already exists for the room, return it
        Optional<ChatMessage> existing = chatMessageRepository.findByRoomIdAndMessageId(roomId, dto.getMessageId());
        if (existing.isPresent()) return existing.get();

        // 4) Build entity from DTO (+ E2EE envelope rules)
        ChatMessage msg = new ChatMessage();
        msg.setRoomId(roomId);
        msg.setSenderId(senderId);
        msg.setMessageId(dto.getMessageId());
        msg.setType(dto.getType());
        msg.setServerTs(Instant.now());

        boolean e2ee = dto.isE2ee() || (dto.getCiphertext() != null && dto.getCiphertext().length > 0);
        if (!e2ee) {
            throw new IllegalArgumentException("Encrypted payload required for chat messages");
        }

        if (dto.getCiphertext() == null || dto.getCiphertext().length == 0) {
            throw new IllegalArgumentException("ciphertext required when e2ee is enabled");
        }
        if (dto.getIv() == null || dto.getIv().length == 0) {
            throw new IllegalArgumentException("iv required when e2ee is enabled");
        }
        if (dto.getAlgo() == null || dto.getAlgo().isBlank()) {
            throw new IllegalArgumentException("algo required when e2ee is enabled");
        }
        if (dto.getKeyRef() == null || dto.getKeyRef().isBlank()) {
            throw new IllegalArgumentException("keyRef required when e2ee is enabled");
        }

        if (dto.getBody() != null && !dto.getBody().isBlank()) {
            log.warn("Dropping plaintext body for e2ee messageId={} roomId={}", dto.getMessageId(), roomId);
        }

        msg.setE2ee(true);
        msg.setE2eeVer(dto.getE2eeVer() == null ? 1 : dto.getE2eeVer());
        msg.setAlgo(dto.getAlgo());
        msg.setAad(dto.getAad());
        msg.setIv(dto.getIv());
        msg.setCiphertext(dto.getCiphertext());
        msg.setKeyRef(dto.getKeyRef());
        msg.setBody(null);

        // 5) Persist (tolerate race duplicates)
        ChatMessage saved;
        try {
            saved = chatMessageRepository.save(msg);
        } catch (DataIntegrityViolationException dup) {
            // Another node/thread beat us — load and return the existing row
            return chatMessageRepository.findByRoomIdAndMessageId(roomId, dto.getMessageId())
                    .orElseThrow(() -> new RuntimeException("Duplicate detected but message not found"));
        }

        // 6) Fire notification to other members (don’t fail the write if notify breaks)
        try {
            if (eventPublisher != null && membership != null) {
                java.util.List<Long> recipients = new java.util.ArrayList<>(membership.memberIds(roomId));
                recipients.removeIf(id -> id.equals(senderId)); // exclude author

                String preview = null;
                if (!saved.isE2ee() && saved.getBody() != null && !saved.getBody().isBlank()) {
                    String b = saved.getBody();
                    preview = b.length() > 140 ? b.substring(0, 140) : b;
                }

                eventPublisher.publishNewMessage(
                        roomId,
                        saved.getMessageId(),
                        senderId,
                        recipients,
                        saved.isE2ee(),
                        preview
                );
            }
        } catch (Exception notifyEx) {
            // Do not rollback the message just because notifications failed
            org.slf4j.LoggerFactory.getLogger(getClass())
                    .warn("notify failure room={} msg={} err={}", roomId, dto.getMessageId(), notifyEx.toString());
        }
        inboxDeliveryService.sendInboxEvent(saved);
        return saved;
    }

     public interface DirectRoomPolicy {
        boolean isDirect(Long roomId);
        Long peer(Long roomId, Long userId);
        boolean maySend(Long senderId, Long peerUserId);
    }

    public MessageDto handlePrivateMessage(MessageDto dto) throws AccessDeniedException {
        String senderId = dto.getSenderId();
        Long receiverId = Long.valueOf(dto.getReceiverId());

        if (dto.getMessageId() == null || dto.getMessageId().isBlank()) {
            throw new IllegalArgumentException("messageId required");
        }

        // Idempotency check: if message already exists, avoid duplicates
        java.util.Optional<Message> existing = messageRepository.findByMessageId(dto.getMessageId());
        if (existing.isPresent()) {
            return toDto(existing.get());
        }


        // Block check: Prevent sender OR receiver from communicating
        if (blockService.isBlocked(senderId, String.valueOf(receiverId))) {

            throw new AccessDeniedException("Messaging blocked between users.");
        }

        // Convert DTO to entity
        Message entity = new Message();
        entity.setSenderId(dto.getSenderId());
        entity.setReceiverId(dto.getReceiverId());
        entity.setType(dto.getType());
        entity.setContent(dto.getContent());
        entity.setMetadata(dto.getMetadata());
        entity.setGroupMessage(false);
        entity.setTimestamp(LocalDateTime.now());
        entity.setMessageId(dto.getMessageId());

        // Save to DB
        Message saved = messageRepository.save(entity);
        unhideDirectRoomForUser(senderId, dto.getReceiverId());
        unhideDirectRoomForUser(dto.getReceiverId(), senderId);

         UUID receiverUuid = UUID.nameUUIDFromBytes(String.valueOf(receiverId).getBytes(StandardCharsets.UTF_8));
        eventPublisher.publish(
                new EventMessage(
                        receiverUuid,
                        "NEW_MESSAGE",
                        Map.of(
                                "senderId", senderId,
                                "content", dto.getContent(),
                                "timestamp", saved.getTimestamp().toString()
                        )
                )
        );

        // Deliver to each active session for the receiver; if no session or a send
        // fails, record the undelivered message for later inspection.
        Long receiverUserId = Long.valueOf(receiverId);
        Set<WebSocketSession> sessions = sessionRegistry.getSessions(receiverUserId);
        if (sessions.isEmpty()) {
            undeliveredStore.record(receiverUserId, String.valueOf(saved.getId()),
                    new IllegalStateException("no active session"));
        } else {
            for (WebSocketSession s : sessions) {
                try {
                    Map<String, Object> headers =
                            Collections.singletonMap(SimpMessageHeaderAccessor.SESSION_ID_HEADER, s.getId());
                    messagingTemplate.convertAndSendToUser(String.valueOf(receiverId),
                            "/queue/private", dto, headers);
                } catch (Exception ex) {
                    undeliveredStore.record(receiverUserId, String.valueOf(saved.getId()), ex);
                }
            }
        }


        // Optionally, send to sender (ack/echo)
        messagingTemplate.convertAndSendToUser(
                 dto.getSenderId(),
                "/queue/private",
                 dto
        );

        return dto;

    }

    public MessageDto toDto(Message message) {
        MessageDto dto = new MessageDto();
        dto.setId(message.getId());
        dto.setSenderId(message.getSenderId());
        dto.setReceiverId(message.getReceiverId());
        dto.setContent(message.getContent());
        dto.setType(message.getType());
        dto.setTimestamp(message.getTimestamp());
        dto.setGroupMessage(message.getGroupMessage());
        dto.setMessageId(message.getMessageId());
        return dto;
    }

    public MessageDto saveCallInvite(MessageDto messageDto) throws AccessDeniedException {

        String senderId = messageDto.getSenderId();
        String receiverId = messageDto.getReceiverId();

        if (blockService.isBlocked(senderId, receiverId)) {
            throw new AccessDeniedException("Call invite blocked between users.");
        }


        // Only allow AUDIO_CALL_INVITE or VIDEO_CALL_INVITE
        if (messageDto.getType() != MessageType.AUDIO_CALL_INVITE &&
                messageDto.getType() != MessageType.VIDEO_CALL_INVITE) {
            throw new IllegalArgumentException("Invalid message type for call invite");
        }

        Message message = new Message();
        message.setSenderId(messageDto.getSenderId());
        message.setReceiverId(messageDto.getReceiverId());
        message.setType(messageDto.getType());
        message.setContent(messageDto.getContent());     // Optional: call room ID or null
        message.setMetadata(messageDto.getMetadata());   // Optional: device info, etc.
        message.setTimestamp(LocalDateTime.now());

        message.setGroupMessage(false);                // Call invites are one-to-one

        Message saved = messageRepository.save(message);

        eventPublisher.publish(new EventMessage(
                UUID.fromString(receiverId),
                "CALL_INVITE",
                Map.of(
                        "senderId", senderId,
                        "callType", messageDto.getType().toString(),
                        "messageId", saved.getId(),
                        "content", messageDto.getContent()
                )
        ));


        return toDto(saved);
    }


    public List<MessageDto> getConversation(String currentUserId, String otherUserId) {
        List<Message> messages = messageRepository.findConversationBetween(currentUserId, otherUserId);
        return messages.stream()
                .filter(m -> {
                    if (m.isDeletedForEveryone()) return false; // globally deleted

                    if (currentUserId.equals(m.getSenderId())) {
                        return !m.isDeletedBySender(); // not hidden by sender
                    } else if (currentUserId.equals(m.getReceiverId())) {
                        return !m.isDeletedByReceiver(); // not hidden by receiver
                    }
                    return false;
                })
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public void deleteMessageForMe(String messageId, String userId) {
        ChatMessage message = chatMessageRepository.findByMessageId(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Message not found"));
        Optional<Long> maybeUserId = parseUserId(userId);
        if (maybeUserId.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User not authorized");
        }
        Long id = maybeUserId.get();
        if (id.equals(message.getSenderId())) {
            message.setDeletedBySender(true);
        } else {
            message.setDeletedByReceiver(true);
        }
        chatMessageRepository.save(message);
        broadcastMessageUpdate(message);
    }

    public void deleteMessageForEveryone(String messageId, String userId) {
        ChatMessage message = chatMessageRepository.findByMessageId(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Message not found"));

        Optional<Long> maybeUserId = parseUserId(userId);
        if (maybeUserId.isEmpty() || !maybeUserId.get().equals(message.getSenderId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only sender can delete for everyone");
        }
        message.setDeletedBySender(true);
        message.setDeletedByReceiver(true);
        message.setDeletedForEveryone(true);
        if (!message.isE2ee()) {
            message.setBody("This message was deleted");
        }
        chatMessageRepository.save(message);
        broadcastMessageUpdate(message);
    }

    private Message toEntity(MessageDto messageDto) {
        Message message = new Message();
        message.setGroupMessage(messageDto.getGroupMessage());
        message.setType(messageDto.getType());
        message.setSenderId(messageDto.getSenderId());
        message.setDeletedForEveryone(false);
        message.setDeletedByReceiver(false);
        message.setDeletedBySender(false);
        message.setContent(messageDto.getContent());
        message.setMetadata(messageDto.getMetadata());
        message.setTimestamp(messageDto.getTimestamp());
        message.setReceiverId(messageDto.getReceiverId());
        message.setMessageId(messageDto.getMessageId());

        return message;
    }

    public CallRoom createCallRoom(String roomId, CallType callType) {
        CallRoom callRoom = new CallRoom();
        callRoom.setRoomId(UUID.randomUUID().toString());
        callRoom.setCallType(callType);
        callRoom.setCreatedAt(LocalDateTime.now());
        return callRoomRepository.save(callRoom);
    }


    @Transactional
    public void deleteConversationForUser(String currentUserId, String otherUserId) {
        List<Message> messages = messageRepository.findConversationBetween(currentUserId, otherUserId);
        boolean updated = false;

        for (Message message : messages) {
            if (message.isDeletedForEveryone()) {
                continue;
            }

            if (currentUserId.equals(message.getSenderId()) && !message.isDeletedBySender()) {
                message.setDeletedBySender(true);
                updated = true;
            }

            if (currentUserId.equals(message.getReceiverId()) && !message.isDeletedByReceiver()) {
                message.setDeletedByReceiver(true);
                updated = true;
            }

            if (message.getDeletedByUserIds().add(currentUserId)) {
                updated = true;
            }
        }

        if (updated) {
            messageRepository.saveAll(messages);
        }

        hideDirectRoomForUser(currentUserId, otherUserId);
    }

    private void hideDirectRoomForUser(String currentUserId, String otherUserId) {
        Optional<Long> maybeUserId = parseUserId(currentUserId);
        Optional<Long> maybePeerId = parseUserId(otherUserId);

        if (maybeUserId.isEmpty() || maybePeerId.isEmpty()) {
            return;
        }

        String pairKey = ChatRoomRepository.buildDirectPairKey(maybeUserId.get(), maybePeerId.get());

        chatRoomRepository.findByDirectPairKeyAndType(pairKey, ChatRoomType.DIRECT)
                .flatMap(room -> chatRoomParticipantRepository.findByUserIdAndChatRoom(maybeUserId.get(), room))
                .ifPresent(participant -> {
                    if (!participant.isHidden()) {
                        participant.setHidden(true);
                        participant.setHiddenAt(LocalDateTime.now());
                        chatRoomParticipantRepository.save(participant);
                        if (membership != null) {
                            membership.evictUserRooms(maybeUserId.get());
                        }
                    }
                });
    }

    private void unhideDirectRoomForUser(String currentUserId, String otherUserId) {
        Optional<Long> maybeUserId = parseUserId(currentUserId);
        Optional<Long> maybePeerId = parseUserId(otherUserId);

        if (maybeUserId.isEmpty() || maybePeerId.isEmpty()) {
            return;
        }

        String pairKey = ChatRoomRepository.buildDirectPairKey(maybeUserId.get(), maybePeerId.get());

        chatRoomRepository.findByDirectPairKeyAndType(pairKey, ChatRoomType.DIRECT)
                .flatMap(room -> chatRoomParticipantRepository.findByUserIdAndChatRoom(maybeUserId.get(), room))
                .ifPresent(participant -> {
                    if (participant.isHidden()) {
                        participant.setHidden(false);
                        participant.setHiddenAt(null);
                        chatRoomParticipantRepository.save(participant);
                        if (membership != null) {
                            membership.evictUserRooms(maybeUserId.get());
                        }
                    }
                });
    }

    private Optional<Long> parseUserId(String rawId) {
        try {
            return Optional.of(Long.valueOf(rawId));
        } catch (NumberFormatException ex) {
            return Optional.empty();
        }
    }


    public List<MessageDto> getGroupMessageHistory(String chatRoomId, String currentUserId) {
        List<Message> messages = messageRepository.findByReceiverIdAndIsGroupMessageTrue(chatRoomId);

        return messages.stream()
                .filter(m ->
                        !Boolean.TRUE.equals(m.isDeletedForEveryone()) &&
                                !m.getDeletedByUserIds().contains(currentUserId)
                )
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    /** Stable broadcast/event shape for subscribers (ascending compatible). */
    public Map<String, Object> toRoomEvent(ChatMessage m) {
        Map<String, Object> e = new HashMap<>();
        e.put("roomId", m.getRoomId());
        e.put("messageId", m.getMessageId());
        e.put("senderId", m.getSenderId());
        e.put("type", m.getType().name());
        e.put("serverTs", m.getServerTs());
        e.put("e2ee", m.isE2ee());
        e.put("deletedBySender", m.isDeletedBySender());
        e.put("deletedByReceiver", m.isDeletedByReceiver());
        e.put("deletedForEveryone", m.isDeletedForEveryone());
        e.put("systemMessage", m.isSystemMessage());
        if (m.isE2ee()) {
            e.put("e2eeVer", m.getE2eeVer());
            e.put("algo", m.getAlgo());
            e.put("aad", m.getAad());
            e.put("iv", m.getIv());
            e.put("ciphertext", m.getCiphertext());
            e.put("keyRef", m.getKeyRef());
        } else {
            e.put("body", m.getBody());
        }
        return e;
    }

    private void broadcastMessageUpdate(ChatMessage message) {
        String roomKey = resolveRoomKey(message.getRoomId());
        Map<String, Object> event = toRoomEvent(message);
        messagingTemplate.convertAndSend("/topic/room." + roomKey, event);
    }

    private String resolveRoomKey(Long roomId) {
        if (roomId == null) {
            return "unknown";
        }
        return chatRoomRepository.findById(roomId)
                .map(ChatRoom::getRoomId)
                .filter(key -> key != null && !key.isBlank())
                .orElse(String.valueOf(roomId));
    }

}
