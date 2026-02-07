package com.om.To_Do.List.ecosystem.dto;

import lombok.Data;
import com.om.To_Do.List.ecosystem.model.ToDoItem;
import java.util.List;

@Data
public class SyncResponse {
    private List<ToDoItem> updatedItems;
    private List<SyncConflictDTO> conflicts;

    public SyncResponse() {
    }

    public SyncResponse(List<ToDoItem> updatedItems, List<SyncConflictDTO> conflicts) {
        this.updatedItems = updatedItems;
        this.conflicts = conflicts;
    }

    public List<ToDoItem> getUpdatedItems() {
        return updatedItems;
    }

    public void setUpdatedItems(List<ToDoItem> updatedItems) {
        this.updatedItems = updatedItems;
    }

    public List<SyncConflictDTO> getConflicts() {
        return conflicts;
    }

    public void setConflicts(List<SyncConflictDTO> conflicts) {
        this.conflicts = conflicts;
    }
}
