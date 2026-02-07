package com.om.Real_Time_Communication.dto;

import java.time.Instant;

public class GetUrlResp {
    private String getUrl;
    private Instant expiresAt;

    public GetUrlResp() {}
    public GetUrlResp(String getUrl, Instant expiresAt) {
        this.getUrl = getUrl; this.expiresAt = expiresAt;
    }
    public String getGetUrl() { return getUrl; }
    public Instant getExpiresAt() { return expiresAt; }
}
