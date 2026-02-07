package com.om.To_Do.List.ecosystem.dto;

import lombok.*;

@Data
@Setter
@Getter
public class LeaveListRequest {
    private Long recipientUserId;

    public LeaveListRequest() {
    }

    public LeaveListRequest(Long recipientUserId) {
        this.recipientUserId = recipientUserId;
    }

    public Long getRecipientUserId() {
        return recipientUserId;
    }

    public void setRecipientUserId(Long recipientUserId) {
        this.recipientUserId = recipientUserId;
    }
}
