package com.om.Notification_Service.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
public class EventMessage {
    private Long userId;
    private List<Long> recipientIds;
    private String type;       // e.g., "MEETING_REMINDER", "NEW_MESSAGE"
    private Map<String, Object> data;
    private int version = 1;

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public List<Long> getRecipientIds() {
        return recipientIds;
    }

    public void setRecipientIds(List<Long> recipientIds) {
        this.recipientIds = recipientIds;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Map<String, Object> getData() {
        return data;
    }

    public void setData(Map<String, Object> data) {
        this.data = data;
    }

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
    }
}

