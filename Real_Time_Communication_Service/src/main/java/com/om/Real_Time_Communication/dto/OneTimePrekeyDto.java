package com.om.Real_Time_Communication.dto;

/**
 * Represents a client-uploaded one-time prekey. Signal clients generate a small numeric
 * identifier alongside the public key; the identifier must be echoed back when another
 * device claims the prekey so it can find the matching private key locally.
 */
public class OneTimePrekeyDto {
    private Integer prekeyId; // nullable for backward compatibility
    private byte[] prekeyPub;

    public Integer getPrekeyId() {
        return prekeyId;
    }

    public void setPrekeyId(Integer prekeyId) {
        this.prekeyId = prekeyId;
    }

    public byte[] getPrekeyPub() {
        return prekeyPub;
    }

    public void setPrekeyPub(byte[] prekeyPub) {
        this.prekeyPub = prekeyPub;
    }
}
