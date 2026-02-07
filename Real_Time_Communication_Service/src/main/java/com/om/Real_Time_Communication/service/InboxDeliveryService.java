package com.om.Real_Time_Communication.service;

import com.om.Real_Time_Communication.Repository.ChatMessageRepository;
import com.om.Real_Time_Communication.Repository.ChatRoomRepository;
import com.om.Real_Time_Communication.Repository.MessageDeliveryRepository;
import com.om.Real_Time_Communication.models.ChatMessage;
import com.om.Real_Time_Communication.models.ChatRoom;
import com.om.Real_Time_Communication.models.MessageDelivery;
import com.om.Real_Time_Communication.models.MessageDeliveryStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class InboxDeliveryService {

    private static final Logger log = LoggerFactory.getLogger(InboxDeliveryService.class);

    private final MessageDeliveryRepository deliveryRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final RoomMembershipService membershipService;
    private final SimpMessagingTemplate messagingTemplate;


    public InboxDeliveryService(
            MessageDeliveryRepository deliveryRepository,
            ChatRoomRepository chatRoomRepository,
            ChatMessageRepository chatMessageRepository,
            RoomMembershipService membershipService,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.deliveryRepository = deliveryRepository;
        this.chatRoomRepository = chatRoomRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.membershipService = membershipService;
        this.messagingTemplate = messagingTemplate;

    }

    public void recordAndDispatch(ChatRoom room, ChatMessage saved, Map<String, Object> baseEvent, List<Long> members) {
        if (room == null || saved == null || members == null) {
            return;
        }

        for (Long memberId : members) {
            if (memberId == null || memberId.equals(saved.getSenderId())) {
                continue; // skip author
            }

            Long peerId = resolvePeerId(room, members, memberId);
            Map<String, Object> inboxPayload = buildInboxPayload(room, saved, baseEvent, peerId);

            MessageDelivery delivery = deliveryRepository.findByMsgIdAndUserId(saved.getMessageId(), memberId)
                    .orElseGet(() -> createPending(saved, room, memberId));

            boolean liveSent = sendIfOnline(memberId, inboxPayload);
            if (liveSent) {
                delivery.setStatus(MessageDeliveryStatus.SENT_TO_WS);
                deliveryRepository.save(delivery);
            }
        }
    }

    private MessageDelivery createPending(ChatMessage saved, ChatRoom room, Long memberId) {
        MessageDelivery delivery = new MessageDelivery();
        delivery.setMsgId(saved.getMessageId());
        delivery.setUserId(memberId);
        delivery.setRoomId(room.getId());
        delivery.setStatus(MessageDeliveryStatus.PENDING);
        return deliveryRepository.save(delivery);
    }

    private boolean sendIfOnline(Long memberId, Map<String, Object> payload) {
        try {
            log.info("[INBOX] send to user={} dest=/queue/inbox msgId={} roomKey={}",
                    memberId, payload.get("msgId"), payload.get("roomKey"));
            messagingTemplate.convertAndSendToUser(
                    String.valueOf(memberId),
                    "/queue/inbox",
                    payload
            );
            return true;
        } catch (Exception ex) {
            log.error("[INBOX][ERROR] failed to send to user={} msgId={} err={}",
                    memberId, payload.get("msgId"), ex.toString());
            return false;
        }
    }

    public List<Map<String, Object>> pendingMessages(Long userId, Instant since) {
        Collection<MessageDeliveryStatus> statuses = EnumSet.of(
                MessageDeliveryStatus.PENDING,
                MessageDeliveryStatus.SENT_TO_WS
        );

        List<MessageDelivery> deliveries = since == null
                ? deliveryRepository.findByUserIdAndStatusInOrderByCreatedAtAsc(userId, statuses)
                : deliveryRepository.findByUserIdAndStatusInAndCreatedAtAfterOrderByCreatedAtAsc(userId, statuses, since);

        List<Map<String, Object>> payloads = new ArrayList<>();
        for (MessageDelivery d : deliveries) {
            ChatRoom room = d.getRoomId() != null
                    ? chatRoomRepository.findById(d.getRoomId()).orElse(null)
                    : null;
            if (room == null) {
                continue;
            }
            ChatMessage msg = chatMessageRepository.findByRoomIdAndMessageId(room.getId(), d.getMsgId())
                    .orElse(null);
            if (msg == null) {
                continue;
            }
            List<Long> members = membershipService.memberIds(room.getId());
            Long peerId = resolvePeerId(room, members, userId);
            Map<String, Object> base = toRoomEvent(msg);
            Map<String, Object> payload = buildInboxPayload(room, msg, base, peerId);
            payloads.add(payload);

            d.setStatus(MessageDeliveryStatus.SENT_TO_WS);
            deliveryRepository.save(d);
        }
        return payloads.stream()
                .sorted(Comparator.comparing((Map<String, Object> p) ->
                        (Instant) p.getOrDefault("createdAt", Instant.EPOCH)))
                .collect(Collectors.toList());
    }

    public void markDelivered(String msgId, Long userId, String deviceId, boolean read) {
        deliveryRepository.findByMsgIdAndUserId(msgId, userId).ifPresent(delivery -> {
            delivery.setDeviceId(deviceId);
            if (read) {
                delivery.setStatus(MessageDeliveryStatus.READ);
                delivery.setReadAt(Instant.now());
            } else {
                delivery.setStatus(MessageDeliveryStatus.DELIVERED_TO_DEVICE);
                delivery.setDeliveredAt(Instant.now());
            }
            deliveryRepository.save(delivery);
        });
    }

    public void sendInboxEvent(ChatMessage saved) {
        if (saved == null || saved.getRoomId() == null) {
            return;
        }

        chatRoomRepository.findById(saved.getRoomId()).ifPresent(room -> {
            List<Long> members = membershipService.memberIds(room.getId());
            Map<String, Object> baseEvent = toRoomEvent(saved);

            for (Long memberId : members) {
                if (memberId == null || memberId.equals(saved.getSenderId())) {
                    continue;
                }

                Long peerId = resolvePeerId(room, members, memberId);
                Map<String, Object> payload = buildInboxPayload(room, saved, baseEvent, peerId);
                boolean sent = sendIfOnline(memberId, payload);
                if (sent) {
                    deliveryRepository.findByMsgIdAndUserId(saved.getMessageId(), memberId)
                            .ifPresent(delivery -> {
                                delivery.setStatus(MessageDeliveryStatus.SENT_TO_WS);
                                deliveryRepository.save(delivery);
                            });
                }
            }
        });
    }

    private Long resolvePeerId(ChatRoom room, List<Long> members, Long recipientId) {
        if (Boolean.TRUE.equals(room.getGroup())) {
            return null;
        }
        if (members == null || members.size() != 2) {
            return null;
        }
        return members.stream().filter(id -> !id.equals(recipientId)).findFirst().orElse(null);
    }

    private Map<String, Object> buildInboxPayload(ChatRoom room, ChatMessage saved, Map<String, Object> baseEvent, Long peerId) {
        Map<String, Object> inboxEvent = new HashMap<>(baseEvent == null ? Collections.emptyMap() : baseEvent);
        inboxEvent.put("type", "message");
        inboxEvent.put("roomKey", room.getRoomId());
        inboxEvent.put("roomName", room.getName());
        inboxEvent.put("roomImage", room.getImageUrl());
        inboxEvent.put("roomDbId", room.getId());
        inboxEvent.put("msgId", saved.getMessageId());
        inboxEvent.put("messageId", saved.getMessageId());
        inboxEvent.put("senderId", saved.getSenderId());
        inboxEvent.put("createdAt", saved.getServerTs());
        if (peerId != null) {
            inboxEvent.put("peerId", peerId);
        }
        return inboxEvent;
    }

    private Map<String, Object> toRoomEvent(ChatMessage m) {
        Map<String, Object> e = new HashMap<>();
        e.put("roomId", m.getRoomId());
        e.put("messageId", m.getMessageId());
        e.put("senderId", m.getSenderId());
        e.put("type", m.getType().name());
        e.put("serverTs", m.getServerTs());
        e.put("e2ee", m.isE2ee());
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
}
