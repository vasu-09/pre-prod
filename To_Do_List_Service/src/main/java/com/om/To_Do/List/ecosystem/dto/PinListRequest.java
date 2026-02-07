package com.om.To_Do.List.ecosystem.dto;

public class PinListRequest {
    private boolean pinned;

    public PinListRequest() {
    }

    public PinListRequest(boolean pinned) {
        this.pinned = pinned;
    }

    public boolean isPinned() {
        return pinned;
    }

    public void setPinned(boolean pinned) {
        this.pinned = pinned;
    }
}
