package com.om.Real_Time_Communication.dto;

import java.time.Instant;

public class UploadIntentResp {
    private String putUrl;
    private Instant expiresAt;

    public UploadIntentResp() {}
    public UploadIntentResp(String putUrl, Instant expiresAt) {
        this.putUrl = putUrl; this.expiresAt = expiresAt;
    }
    public String getPutUrl() { return putUrl; }
    public Instant getExpiresAt() { return expiresAt; }
}
