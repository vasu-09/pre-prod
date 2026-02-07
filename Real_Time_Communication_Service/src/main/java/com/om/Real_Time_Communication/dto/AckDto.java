package com.om.Real_Time_Communication.dto;

import java.time.Instant;

public class AckDto {
    private String  roomId;
    private String messageId;
    private Instant serverTs;

    public AckDto(String  roomId, String messageId, Instant serverTs) {
        this.roomId = roomId; this.messageId = messageId; this.serverTs = serverTs;
    }
    public String  getRoomId() { return roomId; }
    public String getMessageId() { return messageId; }
    public Instant getServerTs() { return serverTs; }
}
