package com.om.To_Do.List.ecosystem.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class ToDoListSummaryDTO {
    private Long id;
    private String title;
    private List<ToDoItemRes> items = new ArrayList<>();
    private String listType;
    private LocalDateTime createdAt;
    private Long createdByUserId;
    private LocalDateTime updatedAt;

    public ToDoListSummaryDTO() {
    }

    public ToDoListSummaryDTO(Long id,String title, List<ToDoItemRes> items, String listType, LocalDateTime  createdAt, LocalDateTime  updatedAt, Long createdByUserId) {
        this.id=id;
        this.title = title;
        setItems(items);
        this.listType = listType;
        this.createdAt=createdAt;
        this.updatedAt=updatedAt;
        this.createdByUserId = createdByUserId;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }


    public LocalDateTime getCreatedAt(LocalDateTime createdAt) {
        return this.createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public Long getCreatedByUserId() {
        return createdByUserId;
    }

    public void setCreatedByUserId(Long createdByUserId) {
        this.createdByUserId = createdByUserId;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getListType() {
        return listType;
    }

    public void setListType(String listType) {
        this.listType = listType;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public List<ToDoItemRes> getItems() {
        return items;
    }

    public void setItems(List<ToDoItemRes> items) {
         if (items == null) {
            this.items = new ArrayList<>();
        } else {
            this.items = new ArrayList<>(items);
        }
    }
}
