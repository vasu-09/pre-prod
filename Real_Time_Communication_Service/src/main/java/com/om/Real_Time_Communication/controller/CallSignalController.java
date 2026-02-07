package com.om.Real_Time_Communication.controller;

import com.om.Real_Time_Communication.dto.CallInviteDto;
import com.om.Real_Time_Communication.dto.IceCandidateDto;
import com.om.Real_Time_Communication.dto.SdpDto;
import com.om.Real_Time_Communication.models.CallSession;
import com.om.Real_Time_Communication.service.CallSessionService;
import com.om.Real_Time_Communication.service.CallSignalIntegrityService;
import com.om.Real_Time_Communication.service.TurnCredsService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.ArrayList;
import java.util.List;


@Controller

public class CallSignalController {

    private final CallSessionService calls;
    private final SimpMessagingTemplate broker;
    private final TurnCredsService turnCreds; // if you issue TURN creds
    private final CallSignalIntegrityService integrity;

    public CallSignalController(CallSessionService calls, SimpMessagingTemplate broker, TurnCredsService turnCreds, CallSignalIntegrityService integrity) {
        this.calls = calls;
        this.broker = broker;
        this.turnCreds = turnCreds;
        this.integrity = integrity;
    }

    // 1) 1:1 INVITE  — client SENDs to /app/call.invite.{roomId}
    @MessageMapping("/call/invite/{roomId}")
    public void invite1to1(@DestinationVariable Long roomId,
                           @Payload CallInviteDto dto,
                           Principal principal) {
        Long callerId = Long.valueOf(principal.getName());
        List<Long> busy = new ArrayList<>();
        if (calls.isUserBusy(callerId)) busy.add(callerId);
        for (Long id : dto.getCalleeIds()) {
            if (calls.isUserBusy(id)) busy.add(id);
        }
        if (!busy.isEmpty()) {
            broker.convertAndSendToUser(principal.getName(), "/queue/call", CallEvents.busy(roomId, busy));
            return;
        }
        try {
            CallSession s = calls.createInvite(
                    roomId,
                    callerId,
                    dto.getCalleeIds(),
                    dto.isE2ee(),
                    dto.getE2eeVer(),
                    dto.getE2eeKeyRef(),
                    dto.getE2eeAlgo()); // size 1 for 1:1

            // fanout room-level event
            broker.convertAndSend("/topic/call.room."+roomId, CallEvents.invite(s, callerId, dto.getCalleeIds()));
            // optionally push TURN creds to caller (and later to callee on ringing)
            broker.convertAndSendToUser(principal.getName(), "/queue/turn", turnCreds.issue(callerId, 300));
        } catch (IllegalStateException e) {
            broker.convertAndSendToUser(principal.getName(), "/queue/call", CallEvents.busy(e.getMessage()));
        }
    }

    // 2) Group INVITE — /app/call.invite.group.{roomId}
    @MessageMapping("/call/invite/group/{roomId}")
    public void inviteGroup(@DestinationVariable Long roomId,
                            @Payload CallInviteDto dto,
                            Principal principal) {
        Long callerId = Long.valueOf(principal.getName());
        List<Long> busy = new ArrayList<>();
        if (calls.isUserBusy(callerId)) busy.add(callerId);
        for (Long id : dto.getCalleeIds()) {
            if (calls.isUserBusy(id)) busy.add(id);
        }
        if (!busy.isEmpty()) {
            broker.convertAndSendToUser(principal.getName(), "/queue/call", CallEvents.busy(roomId, busy));
            return;
        }
        try {
            CallSession s = calls.createInvite(
                    roomId,
                    callerId,
                    dto.getCalleeIds(),
                    dto.isE2ee(),
                    dto.getE2eeVer(),
                    dto.getE2eeKeyRef(),
                    dto.getE2eeAlgo()); // >=1
            broker.convertAndSend("/topic/call.room."+roomId, CallEvents.invite(s, callerId, dto.getCalleeIds()));
        } catch (IllegalStateException e) {
            broker.convertAndSendToUser(principal.getName(), "/queue/call", CallEvents.busy(e.getMessage()));
        }
    }

    // 3) Join group — /app/call.join.{callId}
    @MessageMapping("/call/join/{callId}")
    public void joinGroup(@DestinationVariable Long callId, Principal principal)  {
        Long userId = Long.valueOf(principal.getName());
        try {
            calls.join(callId, userId); // implement in service if not present
            broker.convertAndSend("/topic/call."+callId, CallEvents.join(callId, userId));
            // Deliver any buffered candidates to the user who just joined
            for (CallSignalIntegrityService.PendingCandidate pc : integrity.markJoined(callId, userId)) {
                broker.convertAndSendToUser(userId.toString(), "/queue/call."+callId,
                        CallEvents.candidate(callId, pc.from, pc.dto));
            }
        } catch (IllegalStateException e) {
            broker.convertAndSendToUser(principal.getName(), "/queue/call", CallEvents.busy(e.getMessage()));
        }
    }

    // 4) Leave group — /app/call.leave.{callId}
    @MessageMapping("/call/leave/{callId}")
    public void leaveGroup(@DestinationVariable Long callId, Principal principal) {
        Long userId = Long.valueOf(principal.getName());
        calls.leave(callId, userId); // implement in service
        broker.convertAndSend("/topic/call."+callId, CallEvents.leave(callId, userId));
    }

    // 5) Ringing ack — /app/call.ringing.{callId}
    @MessageMapping("/call/ringing/{callId}")
    public void ringing(@DestinationVariable Long callId, Principal principal) {
        calls.markRinging(callId, Long.valueOf(principal.getName()));
        broker.convertAndSend("/topic/call."+callId, CallEvents.ringing(callId, principal.getName()));
    }

    // 6) Answer — /app/call.answer.{callId}
    @MessageMapping("/call/answer/{callId}")
    public void answer(@DestinationVariable Long callId,
                       @Payload SdpDto dto, Principal principal) {
        Long userId = Long.valueOf(principal.getName());
        calls.answer(callId, userId);
        broker.convertAndSend("/topic/call."+callId, CallEvents.answered(callId, userId, dto));
    }

    // 7) Decline — /app/call.decline.{callId}
    @MessageMapping("/call/decline/{callId}")
    public void decline(@DestinationVariable Long callId, Principal principal) {
        Long userId = Long.valueOf(principal.getName());
        calls.decline(callId, userId);
        broker.convertAndSend("/topic/call."+callId, CallEvents.declined(callId, userId));
    }

    // 8) End (WS) — /app/call.end.{callId}
    @MessageMapping("/call/end/{callId}")
    public void end(@DestinationVariable Long callId, Principal principal) {
        Long userId = Long.valueOf(principal.getName());
        calls.end(callId, userId, "hangup");
        broker.convertAndSend("/topic/call."+callId, CallEvents.ended(callId, userId, "hangup"));
    }

    // 9) ICE candidate relay — /app/call.candidate.{callId}
    @MessageMapping("/call/candidate/{callId}")
    public void candidate(@DestinationVariable Long callId,
                          @Payload IceCandidateDto dto,
                          Principal principal) {
        Long from = Long.valueOf(principal.getName());
        broker.convertAndSend("/topic/call."+callId,
                CallEvents.candidate(callId, from, dto));
        // Buffer for peers who have not yet joined
        integrity.bufferCandidate(callId, from, dto, calls.getParticipants(callId));
    }

    // 10) Re-INVITE / ICE restart — /app/call.reinvite.{callId}
    @MessageMapping("/call/reinvite/{callId}")
    public void reinvite(@DestinationVariable Long callId, Principal principal) {
        calls.renegotiate(callId, Long.valueOf(principal.getName()));
        broker.convertAndSend("/topic/call."+callId, CallEvents.reinvite(callId, principal.getName()));
    }

    @MessageMapping("/call/fail/{callId}")
    public void fail(@DestinationVariable Long callId, Principal principal) {
        Long userId = Long.valueOf(principal.getName());
        calls.fail(callId, userId);
        broker.convertAndSend("/topic/call."+callId, CallEvents.failed(callId, userId));
    }

    static final class CallEvents {
       static java.util.Map<String, Object> invite(CallSession s, Long from, java.util.List<Long> to) {
            java.util.Map<String, Object> m = new java.util.HashMap<>();
            m.put("type", "call.invite");
            m.put("callId", s.getId());
            m.put("roomId", s.getRoomId());
            m.put("from", from);
            m.put("callees", to);
            m.put("topology", s.getTopology());
            m.put("e2ee", s.isE2ee());
            if (s.isE2ee()) {
                if (s.getE2eeVer() != null) m.put("e2eeVer", s.getE2eeVer());
                if (s.getE2eeAlgo() != null) m.put("algo", s.getE2eeAlgo());
                if (s.getE2eeKeyRef() != null) m.put("keyRef", s.getE2eeKeyRef());
            }
            return m;
        }

        static java.util.Map<String, Object> ringing(Long id, String who) {
            var m = new java.util.HashMap<String, Object>();
            m.put("type", "call.ringing");
            m.put("callId", id);
            m.put("by", who);
            return m;
        }

        static java.util.Map<String, Object> answered(Long id, Long by, SdpDto dto) {
            var m = new java.util.HashMap<String, Object>();
            m.put("type", "call.answer");
            m.put("callId", id);
            m.put("by", by);
            applyEnvelope(m, dto, "sdp", dto == null ? null : dto.getSdp());
            return m;
        }

        static java.util.Map<String, Object> declined(Long id, Long by) {
            var m = new java.util.HashMap<String, Object>();
            m.put("type", "call.decline");
            m.put("callId", id);
            m.put("by", by);
            return m;
        }

        static java.util.Map<String, Object> ended(Long id, Long by, String reason) {
            var m = new java.util.HashMap<String, Object>();
            m.put("type", "call.end");
            m.put("callId", id);
            m.put("by", by);
            m.put("reason", reason);
            return m;
        }

        static java.util.Map<String, Object> candidate(Long id, Long by, IceCandidateDto dto) {
            var m = new java.util.HashMap<String, Object>();
            m.put("type", "call.candidate");
            m.put("callId", id);
            m.put("by", by);
            applyEnvelope(m, dto, "candidate", dto == null ? null : dto.getCandidate());
            return m;
        }

        static java.util.Map<String, Object> reinvite(Long id, String by) {
            var m = new java.util.HashMap<String, Object>();
            m.put("type", "call.reinvite");
            m.put("callId", id);
            m.put("by", by);
            return m;
        }

        static java.util.Map<String, Object> join(Long id, Long who) {
            var m = new java.util.HashMap<String, Object>();
            m.put("type", "call.join");
            m.put("callId", id);
            m.put("userId", who);
            return m;
        }

        static java.util.Map<String, Object> leave(Long id, Long who) {
            var m = new java.util.HashMap<String, Object>();
            m.put("type", "call.leave");
            m.put("callId", id);
            m.put("userId", who);
            return m;
        }

        static java.util.Map<String, Object> failed(Long id, Long by) {
            var m = new java.util.HashMap<String, Object>();
            m.put("type", "call.fail");
            m.put("callId", id);
            m.put("by", by);
            return m;
        }

        static java.util.Map<String, Object> busy(String reason) {
            var m = new java.util.HashMap<String, Object>();
            m.put("type", "call.busy");
            m.put("reason", reason);
            return m;
        }

        static java.util.Map<String, Object> busy(Long roomId, java.util.List<Long> busy) {
            var m = new java.util.HashMap<String, Object>();
            m.put("event", "BUSY");
            m.put("roomId", roomId);
            m.put("users", busy);
            return m;
        }

        private static void applyEnvelope(java.util.Map<String, Object> target,
                                          Object maybeDto,
                                          String plaintextKey,
                                          Object plaintext) {
            if (maybeDto == null) {
                target.put("e2ee", false);
                if (plaintext != null) {
                    target.put(plaintextKey, plaintext);
                }
                return;
            }
            if (maybeDto instanceof SdpDto) {
                SdpDto dto = (SdpDto) maybeDto;
                target.put("e2ee", dto.isE2ee());
                if (dto.isE2ee()) {
                    if (dto.getE2eeVer() != null) target.put("e2eeVer", dto.getE2eeVer());
                    if (dto.getAlgo() != null) target.put("algo", dto.getAlgo());
                    if (dto.getAad() != null) target.put("aad", dto.getAad());
                    if (dto.getIv() != null) target.put("iv", dto.getIv());
                    if (dto.getCiphertext() != null) target.put("ciphertext", dto.getCiphertext());
                    if (dto.getKeyRef() != null) target.put("keyRef", dto.getKeyRef());
                } else if (plaintext != null) {
                    target.put(plaintextKey, plaintext);
                }
            } else if (maybeDto instanceof IceCandidateDto) {
                IceCandidateDto dto = (IceCandidateDto) maybeDto;
                target.put("e2ee", dto.isE2ee());
                if (dto.isE2ee()) {
                    if (dto.getE2eeVer() != null) target.put("e2eeVer", dto.getE2eeVer());
                    if (dto.getAlgo() != null) target.put("algo", dto.getAlgo());
                    if (dto.getAad() != null) target.put("aad", dto.getAad());
                    if (dto.getIv() != null) target.put("iv", dto.getIv());
                    if (dto.getCiphertext() != null) target.put("ciphertext", dto.getCiphertext());
                    if (dto.getKeyRef() != null) target.put("keyRef", dto.getKeyRef());
                } else if (plaintext != null) {
                    target.put(plaintextKey, plaintext);
                }
            } else {
                target.put("e2ee", false);
                if (plaintext != null) {
                    target.put(plaintextKey, plaintext);
                }
            }
        }
    }
}
