package com.om.Real_Time_Communication.service;

import com.om.Real_Time_Communication.Repository.CallSessionRepository;
import com.om.Real_Time_Communication.models.CallSession;
import com.om.Real_Time_Communication.models.CallState;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import com.om.Real_Time_Communication.Repository.ChatRoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class CallSessionService {

    private final CallSessionRepository repo;


    private final SimpMessagingTemplate broker;
    private final EventPublisher eventPublisher; // optional (can be null)
    private final ChatRoomRepository chatRoomRepository;

    public CallSessionService(CallSessionRepository repo, SimpMessagingTemplate broker, EventPublisher eventPublisher, ChatRoomRepository chatRoomRepository) {
        this.repo = repo;
        this.broker = broker;
        this.eventPublisher = eventPublisher;
        this.chatRoomRepository = chatRoomRepository;
    }

    private final Clock clock = Clock.systemUTC();

    /** Active participants per call id. */
    private final Map<Long, Set<Long>> activeParticipants = new ConcurrentHashMap<>();

    /**
     * Track active calls in-memory for quick busy checks and cleanup. Call ID -> participants.
     * A second map tracks which call a user is currently part of for O(1) lookups.
     */
    private final ConcurrentMap<Long, Set<Long>> activeCalls = new ConcurrentHashMap<>();
    private final ConcurrentMap<Long, Long> userToCall = new ConcurrentHashMap<>();

    /**
     * Simple topology resolver: P2P for 1:1, SFU otherwise. When using P2P for
     * groups, each participant must upload a stream per peer which quickly
     * multiplies bandwidth requirements. Integrating with an SFU (e.g. Jitsi or
     * mediasoup) is recommended for larger calls.
     */
    private String resolveTopology(int participantsCount) {
        return participantsCount <= 2 ? "P2P" : "SFU";
    }

    /**
     * Create a new invite for a room.
     * @param roomId    chat/call room id
     * @param callerId  initiator user id
     * @param calleeIds list of target users (size 1 for 1:1; >1 == group)
     */
    @Transactional
    public CallSession createInvite(Long roomId,
                                    Long callerId,
                                    List<Long> calleeIds,
                                    boolean e2ee,
                                    Short e2eeVer,
                                    String e2eeKeyRef,
                                    String e2eeAlgo) {
        // Reject if any participant is already engaged in another active call
        List<Long> participants = calleeIds == null ? new java.util.ArrayList<>() : new java.util.ArrayList<>(calleeIds);
        participants.add(callerId);
        List<Long> busy = participants.stream().filter(this::isBusy).collect(Collectors.toList());
        if (!busy.isEmpty()) {
            throw new IllegalStateException("Busy participants: " + busy);
        }

        CallSession s = new CallSession();
        s.setRoomId(roomId);
        s.setInitiatorId(callerId);
        s.setCalleeIdsCsv(calleeIds == null ? "" :
                calleeIds.stream().map(String::valueOf).collect(Collectors.joining(",")));
        s.setState(CallState.INVITE_SENT);
        s.setCreatedAt(Instant.now());
        s.setTopology(resolveTopology(participants.size()));
        s.setE2ee(e2ee);
        s.setE2eeVer(e2eeVer);
        s.setE2eeKeyRef(e2eeKeyRef);
        s.setE2eeAlgo(e2eeAlgo);
        CallSession saved = repo.save(s);

        // Track active call for busy checks
        registerCall(saved.getId(), participants);
        return saved;
    }

    /** Mark ringing (first callee who rings flips state to RINGING). */
    @Transactional
    public CallSession markRinging(Long callId, Long calleeId) {
        CallSession s = load(callId);
        if (s.getState() == CallState.INVITE_SENT) {
            s.setState(CallState.RINGING);
            s.setRingingAt(Instant.now());
        }
        return s;
    }

    /** Answer the call (first answer wins). */
    @Transactional
    public CallSession answer(Long callId, Long userId) {
        CallSession s = load(callId);
        if (s.getState() == CallState.ANSWERED || s.getState() == CallState.ENDED) {
            return s; // idempotent
        }
        // If it was DECLINED/TIMEOUT already, don't resurrect; just return.
        if (s.getState() == CallState.DECLINED || s.getState() == CallState.TIMEOUT) {
            return s;
        }
        s.setState(CallState.ANSWERED);
        s.setAnsweredAt(Instant.now());
        // Mark room as having an active call
        chatRoomRepository.findById(s.getRoomId()).ifPresent(r -> {
            r.setCurrentCallId(callId);
            chatRoomRepository.save(r);
        });
        return s;
    }

    /** Decline the call (idempotent). */
    @Transactional
    public CallSession decline(Long callId, Long userId) {
        CallSession s = load(callId);
        if (s.getState() == CallState.ANSWERED || s.getState() == CallState.ENDED) {
            return s;
        }
        if (s.getState() != CallState.DECLINED) {
            s.setState(CallState.DECLINED);
            s.setEndedAt(Instant.now());
        }
        cleanupActive(callId);
        return s;
    }

    /** End/hangup the call (any participant). */
    @Transactional
    public CallSession end(Long callId, Long userId, String reason) {
        CallSession s = load(callId);
        if (s.getState() != CallState.ENDED) {
            s.setState(CallState.ENDED);
            s.setEndedAt(Instant.now());
        }
        activeParticipants.remove(callId);
        chatRoomRepository.findById(s.getRoomId()).ifPresent(r -> {
            r.setCurrentCallId(null);
            chatRoomRepository.save(r);
        });
        cleanupActive(callId);
        return s;
    }

    /** Group: mark a participant joined; no state change needed for 1:1. */
    @Transactional
    public CallSession join(Long callId, Long userId) {
        if (isBusy(userId) && !userToCall.get(userId).equals(callId)) {
            throw new IllegalStateException("User already in another call: " + userId);
        }
        CallSession s = load(callId);
        registerParticipant(callId, userId);
        activeParticipants.computeIfAbsent(callId, k -> ConcurrentHashMap.newKeySet()).add(userId);
        // Broadcast join event to other participants
        Map<String, Object> evt = new HashMap<>();
        evt.put("type", "call.join");
        evt.put("callId", callId);
        evt.put("userId", userId);
        broker.convertAndSend("/topic/call." + callId, evt);
        return s;
    }

    /** Group: mark a participant left; auto-end when last participant leaves (optional). */
    @Transactional
    public CallSession leave(Long callId, Long userId) {
        CallSession s = load(callId);
        Set<Long> set = activeParticipants.get(callId);
        if (set != null) {
            set.remove(userId);
            if (set.isEmpty()) {
                activeParticipants.remove(callId);
                // Auto-end the call when everyone has left
                end(callId, userId, "last-participant-left");
            }
        }
        Map<String, Object> evt = new HashMap<>();
        evt.put("type", "call.leave");
        evt.put("callId", callId);
        evt.put("userId", userId);
        broker.convertAndSend("/topic/call." + callId, evt);
        return s;
    }

    /** Request renegotiation / ICE restart (no state mutation). */
    @Transactional(readOnly = true)
    public CallSession renegotiate(Long callId, Long userId) {
        return load(callId);
    }

    /**
     * Return all participants in a call (initiator + callees).
     * Used for buffering signaling messages for peers who have not
     * yet joined.
     */
    @Transactional(readOnly = true)
    public List<Long> getParticipants(Long callId) {
        CallSession s = load(callId);
        List<Long> ids = new java.util.ArrayList<>();
        ids.add(s.getInitiatorId());
        if (s.getCalleeIdsCsv() != null && !s.getCalleeIdsCsv().isBlank()) {
            for (String id : s.getCalleeIdsCsv().split(",")) {
                if (!id.isBlank()) {
                    ids.add(Long.valueOf(id));
                }
            }
        }
        return ids;
    }

    /** Get a non-ended session or throw. */
    @Transactional(readOnly = true)
    public CallSession getActiveOrThrow(Long callId) {
        return repo.findByIdAndStateNot(callId, CallState.ENDED)
                .orElseThrow(() -> new IllegalArgumentException("Call not active: " + callId));
    }

    /**
     * Mark the call as failed due to negotiation issues or dropouts.
     */
    @Transactional
    public CallSession fail(Long callId, Long userId) {
        return end(callId, userId, "failure");
    }

    private CallSession load(Long callId) {
        Optional<CallSession> s = repo.findById(callId);
        if (!s.isPresent()) throw new IllegalArgumentException("Call not found: " + callId);
        return s.get();
    }

    /** Auto-timeout unanswered calls (45s). Runs every 5s. */
    @Scheduled(fixedDelayString = "${call.timeout.sweep.delay:10000}")
    @Transactional
    public void sweepTimeouts() {
        Instant cutoff = Instant.now().minusSeconds(45);
        List<CallSession> stale = repo.findStaleInvites(cutoff);
        for (CallSession s : stale) {
            if (s.getState() == CallState.INVITE_SENT || s.getState() == CallState.RINGING) {
                s.setState(CallState.TIMEOUT);
                s.setEndedAt(Instant.now());
                cleanupActive(s.getId());
                try {
                    Map<String,Object> evt = new HashMap<>();
                    evt.put("event","TIMEOUT");
                    evt.put("callId", s.getId());
                    broker.convertAndSend("/topic/call." + s.getId(), evt);
                } catch (Exception ignore) { }
            }
        }
    }

    private boolean isBusy(Long userId) {
        return userToCall.containsKey(userId);
    }

    private void registerCall(Long callId, List<Long> participants) {
        Set<Long> set = ConcurrentHashMap.newKeySet();
        set.addAll(participants);
        activeCalls.put(callId, set);
        participants.forEach(p -> userToCall.put(p, callId));
    }

    private void registerParticipant(Long callId, Long userId) {
        activeCalls.computeIfAbsent(callId, k -> ConcurrentHashMap.newKeySet()).add(userId);
        userToCall.put(userId, callId);
    }

    private void removeParticipant(Long callId, Long userId) {
        Set<Long> parts = activeCalls.get(callId);
        if (parts != null) {
            parts.remove(userId);
            userToCall.remove(userId);
            if (parts.isEmpty()) {
                activeCalls.remove(callId);
            }
        }
    }

    private void cleanupActive(Long callId) {
        Set<Long> parts = activeCalls.remove(callId);
        if (parts != null) {
            for (Long uid : parts) {
                userToCall.remove(uid);
            }
        }
    }

    @Transactional(readOnly = true)
    public boolean isUserBusy(Long userId) {
        String member = "%," + userId + ",%";
        return repo.existsActiveCallForUser(userId, member);
    }

    @Transactional
    public CallSession endCall(Long callSessionId, Long actorUserId, String reason) {
        CallSession cs = repo.findById(callSessionId)
                .orElseThrow(() -> new IllegalArgumentException("Call not found: " + callSessionId));

        // Idempotency: already ended?
        if (cs.getEndedAt() != null || (cs.getState() != null && cs.getState() == CallState.ENDED)) {
            return cs;
        }

        // (Optional) ACL: only participants (or server) can end
        if (actorUserId != null
                && !actorUserId.equals(cs.getInitiatorId())
                && !actorUserId.equals(cs.getInitiatorId())) {
            // If you want to hard-enforce, throw here. For server/admin paths, we allow it.
            // throw new AccessDeniedException("Not a participant");
        }

        Instant now = Instant.now(clock);
        cs.setEndedAt(now);
        if (cs.getCreatedAt() != null) {
            cs.setDuration(Duration.between(cs.getRingingAt(), now).getSeconds());
        }
        cs.setState(CallState.ENDED); // adjust if your enum/string differs

        CallSession saved = repo.save(cs);

        // Build a lightweight event
        Map<String, Object> evt = new HashMap<>();
        evt.put("type", "call.end");
        evt.put("callId", saved.getId());
        evt.put("roomId", saved.getRoomId());
        evt.put("endedBy", actorUserId);
        evt.put("reason", (reason == null || reason.isBlank()) ? "ended" : reason);
        evt.put("endedAt", saved.getEndedAt());
        evt.put("durationSeconds", saved.getDuration());

        // Best-effort STOMP fan-out (don’t break the txn if broker send fails)
        try {
            // Per-call topic (handy for UI tied to a specific call)
            broker.convertAndSend("/topic/call." + saved.getId(), evt);
            // Also emit to the room stream if your clients watch room activity
            broker.convertAndSend("/topic/room." + saved.getRoomId(), evt);
        } catch (Exception ignore) { /* don’t rollback the DB commit */ }

        // Optional: notify Notification Service for missed/ended call

        cleanupActive(callSessionId);
        return saved;
    }
}
