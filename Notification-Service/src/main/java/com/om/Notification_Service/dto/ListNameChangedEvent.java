package com.om.Notification_Service.dto;

import java.util.List;

public class ListNameChangedEvent {
    private Long listId;
    private String oldName;
    private String newName;
    private Long creatorUserId;
    private List<Long> recipientUserIds;

    public ListNameChangedEvent() {
    }

    public ListNameChangedEvent(Long listId, String oldName, String newName, Long creatorUserId, List<Long> recipientUserIds) {
        this.listId = listId;
        this.oldName = oldName;
        this.newName = newName;
        this.creatorUserId = creatorUserId;
        this.recipientUserIds = recipientUserIds;
    }

    public Long getListId() {
        return listId;
    }

    public void setListId(Long listId) {
        this.listId = listId;
    }

    public String getOldName() {
        return oldName;
    }

    public void setOldName(String oldName) {
        this.oldName = oldName;
    }

    public String getNewName() {
        return newName;
    }

    public void setNewName(String newName) {
        this.newName = newName;
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