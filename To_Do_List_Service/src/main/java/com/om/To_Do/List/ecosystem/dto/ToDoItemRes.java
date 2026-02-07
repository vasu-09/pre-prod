package com.om.To_Do.List.ecosystem.dto;

import jakarta.persistence.Column;
import jakarta.persistence.Lob;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

public class ToDoItemRes {
    private Long id;

    private String itemName;       // e.g., "Sugar"

    private String quantity;       // e.g., "1kg pack" (optional)

    private String priceText;      // e.g., "₹50" (optional)


    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String subQuantitiesJson;

    public ToDoItemRes() {
    }

    public ToDoItemRes(Long id, String itemName, String quantity, String priceText, LocalDateTime createdAt, LocalDateTime updatedAt, String subQuantitiesJson) {
        this.id = id;
        this.itemName = itemName;
        this.quantity = quantity;
        this.priceText = priceText;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.subQuantitiesJson = subQuantitiesJson;
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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getSubQuantitiesJson() {
        return subQuantitiesJson;
    }

    public void setSubQuantitiesJson(String subQuantitiesJson) {
        this.subQuantitiesJson = subQuantitiesJson;
    }
}
