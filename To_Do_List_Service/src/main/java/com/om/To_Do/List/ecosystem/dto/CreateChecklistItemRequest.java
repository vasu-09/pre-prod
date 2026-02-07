package com.om.To_Do.List.ecosystem.dto;

/**
 * Request payload for adding a new item to a basic checklist.
 */
public class CreateChecklistItemRequest {
    private String itemName;

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }
}
