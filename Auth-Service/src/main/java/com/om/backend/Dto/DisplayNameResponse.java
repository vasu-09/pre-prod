package com.om.backend.Dto;

public class DisplayNameResponse {
    private String displayName;

    public DisplayNameResponse() {
    }

    public DisplayNameResponse(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }
}
