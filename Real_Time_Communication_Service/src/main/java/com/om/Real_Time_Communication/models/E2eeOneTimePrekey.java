package com.om.Real_Time_Communication.models;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "e2ee_one_time_prekey", indexes = {
        @Index(name="ix_prekey_user_device", columnList="user_id,device_id,consumed,created_at")
})
public class E2eeOneTimePrekey {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;

    @Column(name="user_id", nullable=false) private Long userId;
    @Column(name="device_id", nullable=false, length=64) private String deviceId;

    @Column(name="prekey_id") private Integer prekeyId;

    @Lob @Column(name="prekey_pub", nullable=false) private byte[] prekeyPub; // X25519 pub (32 bytes)
    @Column(name="consumed", nullable=false) private boolean consumed = false;
    @Column(name="created_at", nullable=false) private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public Long getUserId() { return userId; } public void setUserId(Long userId) { this.userId = userId; }
    public String getDeviceId() { return deviceId; } public void setDeviceId(String deviceId) { this.deviceId = deviceId; }
    public Integer getPrekeyId() { return prekeyId; } public void setPrekeyId(Integer prekeyId) { this.prekeyId = prekeyId; }
    public byte[] getPrekeyPub() { return prekeyPub; } public void setPrekeyPub(byte[] prekeyPub) { this.prekeyPub = prekeyPub; }
    public boolean isConsumed() { return consumed; } public void setConsumed(boolean consumed) { this.consumed = consumed; }
    public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
