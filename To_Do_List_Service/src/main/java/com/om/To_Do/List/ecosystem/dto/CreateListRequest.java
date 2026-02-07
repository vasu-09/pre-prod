package com.om.To_Do.List.ecosystem.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Setter
@Getter

public class CreateListRequest {

    private Long createdByUserId;
    private String title;
    private List<ToDoItemDTO> items = new ArrayList<>();

    public CreateListRequest() {
    }

    public CreateListRequest(Long createdByUserId, String title, List<ToDoItemDTO> items) {
        this.createdByUserId = createdByUserId;
        this.title = title;
        setItems(items);
    }

    public Long getCreatedByUserId() {
        return createdByUserId;
    }

    public void setCreatedByUserId(Long createdByUserId) {
        this.createdByUserId = createdByUserId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public List<ToDoItemDTO> getItems() {
        return items;
    }

    public void setItems(List<ToDoItemDTO> items) {
            if (items == null) {
            this.items = new ArrayList<>();
        } else {
            this.items = new ArrayList<>(items);
        }
    }
}
