package com.om.Real_Time_Communication.dto;

import java.time.Instant;

public class CallAckDto {
    public Long callId; public String state; public Instant serverTs;
    public CallAckDto(Long id, String st, Instant ts){ callId=id; state=st; serverTs=ts; }
}
