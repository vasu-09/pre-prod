package com.om.Real_Time_Communication.dto;

/**
 * Request payload used when a client cannot decrypt because the E2EE session is missing or invalid.
 * Captures telemetry fields to help trace the broken chain and triggers a fresh prekey fetch.
 */
public class SessionRecoveryRequest {
    private Long targetUserId;
    private String targetDeviceId;
    private String requesterDeviceId;
    private String sessionId;
    private String keyVersion;
    private String failureReason;

    public Long getTargetUserId() {
        return targetUserId;
    }

    public void setTargetUserId(Long targetUserId) {
        this.targetUserId = targetUserId;
    }

    public String getTargetDeviceId() {
        return targetDeviceId;
    }

    public void setTargetDeviceId(String targetDeviceId) {
        this.targetDeviceId = targetDeviceId;
    }

    public String getRequesterDeviceId() {
        return requesterDeviceId;
    }

    public void setRequesterDeviceId(String requesterDeviceId) {
        this.requesterDeviceId = requesterDeviceId;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getKeyVersion() {
        return keyVersion;
    }

    public void setKeyVersion(String keyVersion) {
        this.keyVersion = keyVersion;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public void setFailureReason(String failureReason) {
        this.failureReason = failureReason;
    }
}
