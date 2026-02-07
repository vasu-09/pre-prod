package com.om.backend.Model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "refresh_tokens",
        indexes = {
                @Index(name="idx_user_device", columnList="userId,deviceId,registrationId,revoked")
        })
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class RefreshTokenEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    /** Signal device identity */
    private int registrationId;   // from libsignal (1..16380)
    private int deviceId;         // 1 for primary

    /** Never store raw token; store a hash */
    @Column(length = 64, nullable = false)
    private String tokenHash;     // hex SHA-256(token)

    private Instant createdAt;
    private Instant expiresAt;
    private boolean revoked = false;

    /** rotation chain (optional but useful) */
    private Long replacedByTokenId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public int getRegistrationId() {
        return registrationId;
    }

    public void setRegistrationId(int registrationId) {
        this.registrationId = registrationId;
    }

    public int getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(int deviceId) {
        this.deviceId = deviceId;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public void setTokenHash(String tokenHash) {
        this.tokenHash = tokenHash;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public boolean isRevoked() {
        return revoked;
    }

    public void setRevoked(boolean revoked) {
        this.revoked = revoked;
    }

    public Long getReplacedByTokenId() {
        return replacedByTokenId;
    }

    public void setReplacedByTokenId(Long replacedByTokenId) {
        this.replacedByTokenId = replacedByTokenId;
    }

    // getters/setters...
}
