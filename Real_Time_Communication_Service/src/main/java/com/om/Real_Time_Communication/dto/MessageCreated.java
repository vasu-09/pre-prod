package com.om.Real_Time_Communication.dto;

import java.time.Instant;

public class MessageCreated {
    public Long roomId;
    public String messageId;
    public Long senderId;
    public String type;       // TEXT or whatever enum name
    public boolean e2ee;
    public Instant serverTs;

    // optional plaintext body if non-E2EE; otherwise null
    public String body;

    // optional E2EE envelope (opaque)
    public Short e2eeVer; public String algo; public byte[] aad; public byte[] iv; public byte[] ciphertext; public String keyRef;
}
