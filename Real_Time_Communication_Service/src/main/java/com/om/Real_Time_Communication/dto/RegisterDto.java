package com.om.Real_Time_Communication.dto;

import java.util.List;

public class RegisterDto {
    private String deviceId;
    private String name;
    private String platform;
    private byte[] identityKeyPub;   // Ed25519 public
    private byte[] signedPrekeyPub;  // Ed25519 public
    private byte[] signedPrekeySig;  // Ed25519 signature over signedPrekeyPub
    private List<OneTimePrekeyDto> oneTimePrekeys;

    public String getDeviceId() { return deviceId; } public void setDeviceId(String deviceId) { this.deviceId = deviceId; }
    public String getName() { return name; } public void setName(String name) { this.name = name; }
    public String getPlatform() { return platform; } public void setPlatform(String platform) { this.platform = platform; }
    public byte[] getIdentityKeyPub() { return identityKeyPub; } public void setIdentityKeyPub(byte[] identityKeyPub) { this.identityKeyPub = identityKeyPub; }
    public byte[] getSignedPrekeyPub() { return signedPrekeyPub; } public void setSignedPrekeyPub(byte[] signedPrekeyPub) { this.signedPrekeyPub = signedPrekeyPub; }
    public byte[] getSignedPrekeySig() { return signedPrekeySig; } public void setSignedPrekeySig(byte[] signedPrekeySig) { this.signedPrekeySig = signedPrekeySig; }
    public List<OneTimePrekeyDto> getOneTimePrekeys() { return oneTimePrekeys; } public void setOneTimePrekeys(List<OneTimePrekeyDto> oneTimePrekeys) { this.oneTimePrekeys = oneTimePrekeys; }
}
