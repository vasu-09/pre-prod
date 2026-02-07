package com.om.Real_Time_Communication.dto;


public class CreateDirectChatRequest {
    private Long participantId;

    public CreateDirectChatRequest() {
    }

    public CreateDirectChatRequest(Long participantId) {
        this.participantId = participantId;
    }

    public Long getParticipantId() {
        return participantId;
    }

    public void setParticipantId(Long participantId) {
        this.participantId = participantId;
    }
}
