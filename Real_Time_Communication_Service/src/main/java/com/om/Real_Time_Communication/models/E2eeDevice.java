package com.om.Real_Time_Communication.models;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "e2ee_device",
        uniqueConstraints = @UniqueConstraint(name = "uq_user_device", columnNames = {"user_id","device_id"}))
public class E2eeDevice {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;

    @Column(name="user_id", nullable=false) private Long userId;
    @Column(name="device_id", nullable=false, length=64) private String deviceId;
    @Column(name="name", length=64) private String name;
    @Column(name="platform", length=16) private String platform;

    @Lob @Column(name="identity_key_pub", nullable=false) private byte[] identityKeyPub;   // Ed25519 pub
    @Lob @Column(name="signed_prekey_pub", nullable=false) private byte[] signedPrekeyPub; // Ed25519 pub
    @Lob @Column(name="signed_prekey_sig", nullable=false) private byte[] signedPrekeySig; // Ed25519 sig

    @Column(name="last_seen", nullable=false) private Instant lastSeen = Instant.now();

    public Long getId() { return id; }
    public Long getUserId() { return userId; } public void setUserId(Long userId) { this.userId = userId; }
    public String getDeviceId() { return deviceId; } public void setDeviceId(String deviceId) { this.deviceId = deviceId; }
    public String getName() { return name; } public void setName(String name) { this.name = name; }
    public String getPlatform() { return platform; } public void setPlatform(String platform) { this.platform = platform; }
    public byte[] getIdentityKeyPub() { return identityKeyPub; } public void setIdentityKeyPub(byte[] identityKeyPub) { this.identityKeyPub = identityKeyPub; }
    public byte[] getSignedPrekeyPub() { return signedPrekeyPub; } public void setSignedPrekeyPub(byte[] signedPrekeyPub) { this.signedPrekeyPub = signedPrekeyPub; }
    public byte[] getSignedPrekeySig() { return signedPrekeySig; } public void setSignedPrekeySig(byte[] signedPrekeySig) { this.signedPrekeySig = signedPrekeySig; }
    public Instant getLastSeen() { return lastSeen; } public void setLastSeen(Instant lastSeen) { this.lastSeen = lastSeen; }
}
