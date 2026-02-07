package com.om.backend.Dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
public class PublicPreKeyBundle {
    private int registrationId;
    private int deviceId;

    private String identityKey;          // base64 public

    private int signedPreKeyId;
    private String signedPreKeyPublic;   // base64 public
    private String signedPreKeySignature;// base64 sig

    private Integer preKeyId;            // nullable when no one-time key available
    private String preKeyPublic;         // nullable


    public PublicPreKeyBundle() {
    }

    public PublicPreKeyBundle(int registrationId, int deviceId, String identityKey, int signedPreKeyId, String signedPreKeyPublic, String signedPreKeySignature, Integer preKeyId, String preKeyPublic) {
        this.registrationId = registrationId;
        this.deviceId = deviceId;
        this.identityKey = identityKey;
        this.signedPreKeyId = signedPreKeyId;
        this.signedPreKeyPublic = signedPreKeyPublic;
        this.signedPreKeySignature = signedPreKeySignature;
        this.preKeyId = preKeyId;
        this.preKeyPublic = preKeyPublic;
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

    public Integer getPreKeyId() {
        return preKeyId;
    }

    public void setPreKeyId(Integer preKeyId) {
        this.preKeyId = preKeyId;
    }

    public String getPreKeyPublic() {
        return preKeyPublic;
    }

    public void setPreKeyPublic(String preKeyPublic) {
        this.preKeyPublic = preKeyPublic;
    }
}
