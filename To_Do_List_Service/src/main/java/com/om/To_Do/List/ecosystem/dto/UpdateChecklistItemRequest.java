package com.om.To_Do.List.ecosystem.dto;


import lombok.Data;

@Data
public class UpdateChecklistItemRequest {
    private String itemName; // only field allowed for checklist updates

    public UpdateChecklistItemRequest() {
    }

    public UpdateChecklistItemRequest(String itemName) {
        this.itemName = itemName;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }
}
