package com.om.To_Do.List.ecosystem.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class SyncItemDTO {
    private Long id;
    private String itemName;
    private String quantity;
    private String priceText;
    private String subQuantitiesJson;
    private String action;
    private LocalDateTime updatedAt;

    public SyncItemDTO() {
    }

    public SyncItemDTO(Long id, String itemName, String quantity, String priceText,
                       String subQuantitiesJson, String action, LocalDateTime updatedAt) {
        this.id = id;
        this.itemName = itemName;
        this.quantity = quantity;
        this.priceText = priceText;
        this.subQuantitiesJson = subQuantitiesJson;
        this.action = action;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public String getQuantity() {
        return quantity;
    }

    public void setQuantity(String quantity) {
        this.quantity = quantity;
    }

    public String getPriceText() {
        return priceText;
    }

    public void setPriceText(String priceText) {
        this.priceText = priceText;
    }

    public String getSubQuantitiesJson() {
        return subQuantitiesJson;
    }

    public void setSubQuantitiesJson(String subQuantitiesJson) {
        this.subQuantitiesJson = subQuantitiesJson;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
