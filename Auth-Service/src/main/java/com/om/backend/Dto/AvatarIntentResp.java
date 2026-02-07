package com.om.backend.Dto;

import java.time.Instant;

public class AvatarIntentResp {
    private String key;
    private String putUrl;
    private Instant expiresAt;
    private Long maxSize;

    public AvatarIntentResp() {}
    public AvatarIntentResp(String key, String putUrl, Instant expiresAt, Long maxSize) {
        this.key = key; this.putUrl = putUrl; this.expiresAt = expiresAt; this.maxSize = maxSize;
    }
    // convenience ctor if you pass an int
    public AvatarIntentResp(String key, String putUrl, Instant expiresAt, int maxSize) {
        this(key, putUrl, expiresAt, Long.valueOf(maxSize));
    }
    public String getKey() { return key; }
    public String getPutUrl() { return putUrl; }
    public Instant getExpiresAt() { return expiresAt; }
    public Long getMaxSize() { return maxSize; }
}
