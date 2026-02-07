package com.om.To_Do.List.ecosystem.dto;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

@Data
public class SyncRequest {
     private List<SyncItemDTO> items = new ArrayList<>();

    public SyncRequest() {
    }

    public SyncRequest(List<SyncItemDTO> items) {
       setItems(items);
    }

    public List<SyncItemDTO> getItems() {
        return items;
    }

    public void setItems(List<SyncItemDTO> items) {
        if (items == null) {
            this.items = new ArrayList<>();
        } else {
            this.items = new ArrayList<>(items);
        }
    }
}
