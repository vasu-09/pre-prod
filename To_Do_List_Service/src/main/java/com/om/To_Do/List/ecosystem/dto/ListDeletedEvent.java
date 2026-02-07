package com.om.To_Do.List.ecosystem.dto;

import java.util.List;

public class ListDeletedEvent {
    private Long listId;
    private String listName;
    private Long creatorUserId;
    private List<Long> recipientUserIds;

    public ListDeletedEvent() {
    }

    public ListDeletedEvent(Long listId, String listName, Long creatorUserId, List<Long> recipientUserIds) {
        this.listId = listId;
        this.listName = listName;
        this.creatorUserId = creatorUserId;
        this.recipientUserIds = recipientUserIds;
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

    public List<Long> getRecipientUserIds() {
        return recipientUserIds;
    }

    public void setRecipientUserIds(List<Long> recipientUserIds) {
        this.recipientUserIds = recipientUserIds;
    }
}