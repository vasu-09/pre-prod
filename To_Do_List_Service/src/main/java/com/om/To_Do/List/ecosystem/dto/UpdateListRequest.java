package com.om.To_Do.List.ecosystem.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;


public class UpdateListRequest {
    private String title;
    private List<ToDoItemDTO> items = new ArrayList<>();

    public UpdateListRequest() {
    }

    public UpdateListRequest(String title, List<ToDoItemDTO> items) {
        this.title = title;
        setItems(items);
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
