package com.om.Notification_Service.dto;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.time.Instant;
import java.util.Set;
@Getter
@RequiredArgsConstructor
public class ChatRoomDto {
    private String id;
    private ChatRoomType type;
    private Set<String> participantIds;
    private String name;            // only for GROUP rooms
    private Instant createdAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public ChatRoomType getType() {
        return type;
    }

    public void setType(ChatRoomType type) {
        this.type = type;
    }

    public Set<String> getParticipantIds() {
        return participantIds;
    }

    public void setParticipantIds(Set<String> participantIds) {
        this.participantIds = participantIds;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
