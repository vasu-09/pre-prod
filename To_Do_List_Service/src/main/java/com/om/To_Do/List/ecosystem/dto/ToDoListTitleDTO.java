package com.om.To_Do.List.ecosystem.dto;

import lombok.Data;

@Data
public class ToDoListTitleDTO {
    private Long id;
    private String title;
    private boolean pinned;

    public ToDoListTitleDTO() {

    }

    public ToDoListTitleDTO(Long id, String title, boolean pinned) {
        this.id = id;
        this.title = title;
        this.pinned = pinned;
    }


    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }
    
    public boolean isPinned() {
        return pinned;
    }

    public void setPinned(boolean pinned) {
        this.pinned = pinned;
    }
}

