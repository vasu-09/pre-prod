package com.om.To_Do.List.ecosystem.dto;

import java.util.List;

/**
 * Request payload for adding a new item to a premium list.
 */
public class CreateItemRequest {
    private String itemName;
    private String quantity;
    private String priceText;
    private List<SubQuantityDTO> subQuantities;

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

    public void setSubQuantities(List<SubQuantityDTO> subQuantities) {
        this.subQuantities = subQuantities;
    }
}
