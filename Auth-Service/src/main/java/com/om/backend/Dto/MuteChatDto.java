package com.om.backend.Dto;

public class MuteChatDto {
    public String mutedUntil; // ISO-8601, or null to clear (use DELETE endpoint alternatively)

    public MuteChatDto() {
    }

    public MuteChatDto(String mutedUntil) {
        this.mutedUntil = mutedUntil;
    }

    public String getMutedUntil() {
        return mutedUntil;
    }

    public void setMutedUntil(String mutedUntil) {
        this.mutedUntil = mutedUntil;
    }
}
