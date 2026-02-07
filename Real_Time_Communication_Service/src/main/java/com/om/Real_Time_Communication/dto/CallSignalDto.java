package com.om.Real_Time_Communication.dto;

import lombok.*;

import java.util.List;

@Data
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class CallSignalDto {
    public Long callId;           // null on first INVITE (server assigns)
    public String sdp;            // offer/answer (base64 or raw)
    public String type;           // "offer","answer","candidate","renegotiate"
    public String candidate;      // for ICE candidate messages
    public String deviceId;       // useful to track
    public List<Long> calleeIds;
}
