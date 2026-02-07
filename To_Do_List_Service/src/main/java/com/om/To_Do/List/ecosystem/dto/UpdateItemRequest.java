package com.om.To_Do.List.ecosystem.dto;

import lombok.*;

import java.util.List;

@Data

public class UpdateItemRequest {
    private String itemName;
    private String quantity;
    private String priceText;
    private List<SubQuantityDTO> subQuantities;

    public UpdateItemRequest() {
    }

    public UpdateItemRequest(String itemName, String quantity, String priceText, List<SubQuantityDTO> subQuantitiesJson) {
        this.itemName = itemName;
        this.quantity = quantity;
        this.priceText = priceText;
        this.subQuantities = subQuantitiesJson;
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

    public List<SubQuantityDTO> getSubQuantities() {
        return subQuantities;
    }

    public void setSubQuantitiesJson(List<SubQuantityDTO> subQuantitiesJson) {
        this.subQuantities = subQuantitiesJson;
    }
}