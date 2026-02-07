package com.om.Real_Time_Communication.dto;

import lombok.Data;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Data
@RequiredArgsConstructor
@Getter
public class RecipientsRemovedFromListEvent {
    private Long listId;
    private String listName;
    private Long removerUserId;
    private Long removedUserId;

    public RecipientsRemovedFromListEvent(Long listId,
                                          String listName,
                                          Long removerUserId,
                                          Long removedUserId) {
        this.listId         = listId;
        this.listName       = listName;
        this.removerUserId  = removerUserId;
        this.removedUserId  = removedUserId;
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

    public Long getRemoverUserId() {
        return removerUserId;
    }

    public void setRemoverUserId(Long removerUserId) {
        this.removerUserId = removerUserId;
    }

    public Long getRemovedUserId() {
        return removedUserId;
    }

    public void setRemovedUserId(Long removedUserId) {
        this.removedUserId = removedUserId;
    }
}
