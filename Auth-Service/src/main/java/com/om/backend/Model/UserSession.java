package com.om.backend.Model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.domain.Persistable;

import java.time.Instant;

@Entity
@Data
@Getter
@Setter
@Table(name="user_session")
public class UserSession implements Persistable<String> {
    @Id

    private String id; // Unique session ID

    @Transient
    private boolean isNewEntity = true;

    private  String phoneNumber;
    private String sessionToken; // JWT token or session token for authentication

    private boolean isActive; // Whether the session is still active or expired

    @Column(name = "created_at")       private Instant createdAt;
    @Column(name = "last_seen_at")     private Instant lastSeenAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_user_session_user"))
    private User user;   // <-- NOT userId; this is the User entity



    // NEW
    @Column(name = "fcm_token", length = 2048) private String fcmToken;
    @Column(name = "device_model")             private String deviceModel;
    @Column(name = "platform")                 private String platform;   // "android"
    @Column(name = "app_version")              private String appVersion;
    @Column(name = "revoked_at")               private Instant revokedAt; // null = active

    @Column(name = "refresh_token_hash") private byte[]  refreshTokenHash;
    @Column(name = "refresh_jti")        private String  refreshJti;
    @Column(name = "refresh_expires_at") private Instant refreshExpiresAt;
    @Column(name = "refresh_rotated_at") private Instant refreshRotatedAt;

    // --- getters/setters ---


    @Override
    public boolean isNew() {
        return isNewEntity;
    }

    @PrePersist
    @PostLoad
    public void markNotNew() {
        this.isNewEntity = false;
    }
    public byte[] getRefreshTokenHash() {
        return refreshTokenHash;
    }

    public void setRefreshTokenHash(byte[] refreshTokenHash) {
        this.refreshTokenHash = refreshTokenHash;
    }

    public String getRefreshJti() {
        return refreshJti;
    }

    public void setRefreshJti(String refreshJti) {
        this.refreshJti = refreshJti;
    }

    public Instant getRefreshExpiresAt() {
        return refreshExpiresAt;
    }

    public void setRefreshExpiresAt(Instant refreshExpiresAt) {
        this.refreshExpiresAt = refreshExpiresAt;
    }

    public Instant getRefreshRotatedAt() {
        return refreshRotatedAt;
    }

    public void setRefreshRotatedAt(Instant refreshRotatedAt) {
        this.refreshRotatedAt = refreshRotatedAt;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(Instant lastSeenAt) { this.lastSeenAt = lastSeenAt; }
    public String getFcmToken() { return fcmToken; }
    public void setFcmToken(String fcmToken) { this.fcmToken = fcmToken; }
    public String getDeviceModel() { return deviceModel; }
    public void setDeviceModel(String deviceModel) { this.deviceModel = deviceModel; }
    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }
    public String getAppVersion() { return appVersion; }
    public void setAppVersion(String appVersion) { this.appVersion = appVersion; }
    public Instant getRevokedAt() { return revokedAt; }
    public void setRevokedAt(Instant revokedAt) { this.revokedAt = revokedAt; }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getSessionToken() {
        return sessionToken;
    }

    public void setSessionToken(String sessionToken) {
        this.sessionToken = sessionToken;
    }



    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean active) {
        isActive = active;
    }

}

