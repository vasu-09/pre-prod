package com.om.Real_Time_Communication.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;
import java.util.UUID;


@Getter
@Setter
@NoArgsConstructor
public class EventMessage {
    private UUID userId;
    private String type;       // e.g., "MEETING_REMINDER", "NEW_MESSAGE"
    private Map<String, Object> data;

    public EventMessage(UUID userId, String type, Map<String, Object> data) {
        this.userId = userId;
        this.type = type;
        this.data = data;
    }
}
