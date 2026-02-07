package com.om.Notification_Service.dto;



import java.util.List;

public class RecipientsAddedToListEvent {
    private final Long listId;
    private final String listName;
    private final Long creatorUserId;
    private final List<Long> newUserIds;

    public RecipientsAddedToListEvent(Long listId, String listName, Long creatorUserId, List<Long> newUserIds) {
        this.listId = listId;
        this.listName = listName;
        this.creatorUserId = creatorUserId;
        this.newUserIds = newUserIds;
    }

    public Long getListId() {
        return listId;
    }

    public String getListName() {
        return listName;
    }

    public Long getCreatorUserId() {
        return creatorUserId;
    }

    public List<Long> getNewUserIds() {
        return newUserIds;
    }
}
