package com.om.To_Do.List.ecosystem.dto;

public class UpdateListNameRequest {
    private String newName;

    public UpdateListNameRequest() {
    }

    public UpdateListNameRequest(String newName) {
        this.newName = newName;
    }

    public String getNewName() {
        return newName;
    }

    public void setNewName(String newName) {
        this.newName = newName;
    }
}