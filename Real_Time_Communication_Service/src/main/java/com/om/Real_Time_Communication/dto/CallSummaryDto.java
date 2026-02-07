package com.om.Real_Time_Communication.dto;

import com.om.Real_Time_Communication.models.CallState;

import java.time.Instant;
import java.util.List;

public class CallSummaryDto {
    private Long callId;
    private Long roomId;
    private Long initiatorId;
    private List<Long> participants; // initiator + callees
    private CallState state;
    private String topology;        // P2P/SFU
    private Instant createdAt;
    private Instant answeredAt;
    private Instant endedAt;
    private long durationSec;       // 0 if not ended
    private boolean missed;         // unanswered (TIMEOUT/DECLINED with no ANSWERED)
    private boolean e2ee;
    private Short e2eeVer;
    private String e2eeKeyRef;
    private String e2eeAlgo;

    public CallSummaryDto() {}

    public CallSummaryDto(Long callId, Long roomId, Long initiatorId, List<Long> participants,
                          CallState state, String topology, Instant createdAt,
                           Instant answeredAt, Instant endedAt,
                          boolean e2ee, Short e2eeVer, String e2eeKeyRef, String e2eeAlgo) {
        this.callId = callId;
        this.roomId = roomId;
        this.initiatorId = initiatorId;
        this.participants = participants;
        this.state = state;
        this.topology = topology;
        this.createdAt = createdAt;
        this.answeredAt = answeredAt;
        this.endedAt = endedAt;
        this.durationSec = (endedAt != null && createdAt != null)
                ? Math.max(0, endedAt.getEpochSecond() - createdAt.getEpochSecond()) : 0;
        this.missed = (answeredAt == null) && (state == CallState.TIMEOUT || state == CallState.DECLINED);
        this.e2ee = e2ee;
        this.e2eeVer = e2eeVer;
        this.e2eeKeyRef = e2eeKeyRef;
        this.e2eeAlgo = e2eeAlgo;
    }

    public Long getCallId() { return callId; }
    public void setCallId(Long callId) { this.callId = callId; }
    public Long getRoomId() { return roomId; }
    public void setRoomId(Long roomId) { this.roomId = roomId; }
    public Long getInitiatorId() { return initiatorId; }
    public void setInitiatorId(Long initiatorId) { this.initiatorId = initiatorId; }
    public List<Long> getParticipants() { return participants; }
    public void setParticipants(List<Long> participants) { this.participants = participants; }
    public CallState getState() { return state; }
    public void setState(CallState state) { this.state = state; }
    public String getTopology() { return topology; }
    public void setTopology(String topology) { this.topology = topology; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getAnsweredAt() { return answeredAt; }
    public void setAnsweredAt(Instant answeredAt) { this.answeredAt = answeredAt; }
    public Instant getEndedAt() { return endedAt; }
    public void setEndedAt(Instant endedAt) { this.endedAt = endedAt; }
    public long getDurationSec() { return durationSec; }
    public void setDurationSec(long durationSec) { this.durationSec = durationSec; }
    public boolean isMissed() { return missed; }
    public void setMissed(boolean missed) { this.missed = missed; }
    public boolean isE2ee() { return e2ee; }
    public void setE2ee(boolean e2ee) { this.e2ee = e2ee; }
    public Short getE2eeVer() { return e2eeVer; }
    public void setE2eeVer(Short e2eeVer) { this.e2eeVer = e2eeVer; }
    public String getE2eeKeyRef() { return e2eeKeyRef; }
    public void setE2eeKeyRef(String e2eeKeyRef) { this.e2eeKeyRef = e2eeKeyRef; }
    public String getE2eeAlgo() { return e2eeAlgo; }
    public void setE2eeAlgo(String e2eeAlgo) { this.e2eeAlgo = e2eeAlgo; }
}
