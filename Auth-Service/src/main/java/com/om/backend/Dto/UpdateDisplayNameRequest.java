package com.om.backend.Dto;

public class UpdateDisplayNameRequest {
    private String displayName;

    public UpdateDisplayNameRequest() {
    }

    public UpdateDisplayNameRequest(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }
}
