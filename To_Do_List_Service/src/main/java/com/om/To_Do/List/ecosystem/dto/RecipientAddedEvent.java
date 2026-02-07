package com.om.To_Do.List.ecosystem.dto;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.List;


public class RecipientAddedEvent {
    private  Long listId;
    private  String listName;
    private  Long creatorUserId;
    private  List<Long> newUserIds;

    public RecipientAddedEvent() {
    }

    public Long getListId() {
        return listId;
    }

    public void setListId(Long listId) {
        this.listId = listId;
    }

    public String getListName() {
        return listName;
    }

    public void setListName(String listName) {
        this.listName = listName;
    }

    public Long getCreatorUserId() {
        return creatorUserId;
    }

    public void setCreatorUserId(Long creatorUserId) {
        this.creatorUserId = creatorUserId;
    }

    public List<Long> getNewUserIds() {
        return newUserIds;
    }

    public void setNewUserIds(List<Long> newUserIds) {
        this.newUserIds = newUserIds;
    }

    public RecipientAddedEvent(Long listId, String listName, Long creatorUserId, List<Long> newUserIds) {
        this.listId = listId;
        this.listName = listName;
        this.creatorUserId = creatorUserId;
        this.newUserIds = newUserIds;
    }
}