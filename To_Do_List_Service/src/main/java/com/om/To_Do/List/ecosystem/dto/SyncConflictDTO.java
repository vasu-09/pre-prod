package com.om.To_Do.List.ecosystem.dto;

import lombok.Data;

@Data
public class SyncConflictDTO {
    private Long itemId;
    private String message;

    public SyncConflictDTO() {
    }

    public SyncConflictDTO(Long itemId, String message) {
        this.itemId = itemId;
        this.message = message;
    }

    public Long getItemId() {
        return itemId;
    }

    public void setItemId(Long itemId) {
        this.itemId = itemId;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
