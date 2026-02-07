package com.om.To_Do.List.ecosystem.dto;


import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;


public class ToDoItemDTO {
    private String itemName;
    private String quantity;
    private String priceText;
    private List<SubQuantityDTO> subQuantities;

    public ToDoItemDTO() {
    }

    public ToDoItemDTO(String itemName, String quantity, String priceText, List<SubQuantityDTO> subQuantities) {
        this.itemName = itemName;
        this.quantity = quantity;
        this.priceText = priceText;
        this.subQuantities = subQuantities;
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

    public void setSubQuantities(List<SubQuantityDTO>  subQuantitiesJson) {
        this.subQuantities = subQuantitiesJson;
    }
}
