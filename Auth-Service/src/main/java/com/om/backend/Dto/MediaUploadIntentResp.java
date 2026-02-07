package com.om.backend.Dto;
import java.time.Instant;


public class MediaUploadIntentResp {
    private String putUrl;
    private Instant expiresAt;

    public MediaUploadIntentResp() {}
    public MediaUploadIntentResp(String putUrl, Instant expiresAt) {
        this.putUrl = putUrl; this.expiresAt = expiresAt;
    }
    public String getPutUrl() { return putUrl; }
    public Instant getExpiresAt() { return expiresAt; }
}