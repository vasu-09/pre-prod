package com.om.To_Do.List.ecosystem.dto;

public class SubQuantityDTO {
    private String quantity;
    private String priceText;

    public SubQuantityDTO() {
    }

    public SubQuantityDTO(String quantity, String priceText) {
        this.quantity = quantity;
        this.priceText = priceText;
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
}
