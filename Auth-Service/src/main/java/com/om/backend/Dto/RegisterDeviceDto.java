package com.om.backend.Dto;

public class RegisterDeviceDto {
    public String sessionId;
    public String fcmToken;
    public String deviceModel;
    public String appVersion;
    public String platform = "android";

    public RegisterDeviceDto() {
    }

    public RegisterDeviceDto(String sessionId, String fcmToken, String deviceModel, String appVersion, String platform) {
        this.sessionId = sessionId;
        this.fcmToken = fcmToken;
        this.deviceModel = deviceModel;
        this.appVersion = appVersion;
        this.platform = platform;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getFcmToken() {
        return fcmToken;
    }

    public void setFcmToken(String fcmToken) {
        this.fcmToken = fcmToken;
    }

    public String getDeviceModel() {
        return deviceModel;
    }

    public void setDeviceModel(String deviceModel) {
        this.deviceModel = deviceModel;
    }

    public String getAppVersion() {
        return appVersion;
    }

    public void setAppVersion(String appVersion) {
        this.appVersion = appVersion;
    }

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }
}
