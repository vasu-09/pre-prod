package com.om.backend.Model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "one_time_prekeys",
        indexes = {@Index(name="idx_user_device_consumed", columnList = "userId,deviceId,consumed")})
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class OneTimePreKeyEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private int deviceId;            // 1 for primary
    private int preKeyId;

    @Column(length = 255)
    private String preKeyPublic;     // base64 public key

    private boolean consumed = false;
    private Instant createdAt = Instant.now();
    private Instant consumedAt;
    // getters/setters

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

    public int getPreKeyId() {
        return preKeyId;
    }

    public void setPreKeyId(int preKeyId) {
        this.preKeyId = preKeyId;
    }

    public String getPreKeyPublic() {
        return preKeyPublic;
    }

    public void setPreKeyPublic(String preKeyPublic) {
        this.preKeyPublic = preKeyPublic;
    }

    public boolean isConsumed() {
        return consumed;
    }

    public void setConsumed(boolean consumed) {
        this.consumed = consumed;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getConsumedAt() {
        return consumedAt;
    }

    public void setConsumedAt(Instant consumedAt) {
        this.consumedAt = consumedAt;
    }
}
