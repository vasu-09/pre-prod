package com.om.backend.Model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "prekey_meta")
public class PreKeyBundleEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private int deviceId;           // usually 1
    private int registrationId;     // 1..16380 (libsignal constraint)

    @Column(length = 255)
    private String identityKey;     // base64 public key

    private int signedPreKeyId;

    @Column(length = 255)
    private String signedPreKeyPublic;     // base64 public key

    @Column(length = 255)
    private String signedPreKeySignature;  // base64 signature

    private Instant updatedAt;

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

    public int getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(int deviceId) {
        this.deviceId = deviceId;
    }

    public int getRegistrationId() {
        return registrationId;
    }

    public void setRegistrationId(int registrationId) {
        this.registrationId = registrationId;
    }

    public String getIdentityKey() {
        return identityKey;
    }

    public void setIdentityKey(String identityKey) {
        this.identityKey = identityKey;
    }

    public int getSignedPreKeyId() {
        return signedPreKeyId;
    }

    public void setSignedPreKeyId(int signedPreKeyId) {
        this.signedPreKeyId = signedPreKeyId;
    }

    public String getSignedPreKeyPublic() {
        return signedPreKeyPublic;
    }

    public void setSignedPreKeyPublic(String signedPreKeyPublic) {
        this.signedPreKeyPublic = signedPreKeyPublic;
    }

    public String getSignedPreKeySignature() {
        return signedPreKeySignature;
    }

    public void setSignedPreKeySignature(String signedPreKeySignature) {
        this.signedPreKeySignature = signedPreKeySignature;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    // getters/setters
}