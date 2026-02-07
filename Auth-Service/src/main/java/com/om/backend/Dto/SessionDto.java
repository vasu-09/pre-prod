package com.om.backend.Dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class SessionDto {
    private String  sessionId;        // your device/session identifier
    private String  device;           // e.g., "Pixel 7"
    private String  platform;         // e.g., "android"
    private String  appVersion;       // e.g., "1.3.0"
    private Instant createdAt;
    private Instant lastSeenAt;
    private Instant revokedAt;        // null = active
    private boolean current;          // is this the session making the request?
    private Boolean pushEnabled;      // true if FCM token present (optional)
    private Instant refreshExpiresAt; // if you store refresh exp on the session (optional)

    public SessionDto() {}

    // --- getters/setters ---
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getDevice() { return device; }
    public void setDevice(String device) { this.device = device; }

    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }

    public String getAppVersion() { return appVersion; }
    public void setAppVersion(String appVersion) { this.appVersion = appVersion; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(Instant lastSeenAt) { this.lastSeenAt = lastSeenAt; }

    public Instant getRevokedAt() { return revokedAt; }
    public void setRevokedAt(Instant revokedAt) { this.revokedAt = revokedAt; }

    public boolean isCurrent() { return current; }
    public void setCurrent(boolean current) { this.current = current; }

    public Boolean getPushEnabled() { return pushEnabled; }
    public void setPushEnabled(Boolean pushEnabled) { this.pushEnabled = pushEnabled; }

    public Instant getRefreshExpiresAt() { return refreshExpiresAt; }
    public void setRefreshExpiresAt(Instant refreshExpiresAt) { this.refreshExpiresAt = refreshExpiresAt; }
}
