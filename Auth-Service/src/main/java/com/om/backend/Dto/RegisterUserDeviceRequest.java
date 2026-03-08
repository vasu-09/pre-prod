package com.om.backend.Dto;

public class RegisterUserDeviceRequest {
    private Long userId;
    private String sessionId;
    private String fcmToken;
    private String platform;
    private String deviceModel;
    private String appVersion;

    public RegisterUserDeviceRequest() {
    }

    public RegisterUserDeviceRequest(Long userId, String sessionId, String fcmToken, String platform, String deviceModel, String appVersion) {
        this.userId = userId;
        this.sessionId = sessionId;
        this.fcmToken = fcmToken;
        this.platform = platform;
        this.deviceModel = deviceModel;
        this.appVersion = appVersion;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
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

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
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
}