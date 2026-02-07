package com.om.To_Do.List.ecosystem.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Data
@Builder
@Table(name = "todo_items")
public class ToDoItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
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
    private String subQuantitiesJson; // JSON string for sub-quantities (optional)

    @ManyToOne
    @JoinColumn(name = "list_id")
    private ToDoList list;

    public ToDoItem() {
    }

    public ToDoItem(Long id, String itemName, String quantity, String priceText,
                    LocalDateTime createdAt, LocalDateTime updatedAt,
                    String subQuantitiesJson, ToDoList list) {
        this.id = id;
        this.itemName = itemName;
        this.quantity = quantity;
        this.priceText = priceText;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.subQuantitiesJson = subQuantitiesJson;
        this.list = list;
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

    public ToDoList getList() {
        return list;
    }

    public void setList(ToDoList list) {
        this.list = list;
    }
}
