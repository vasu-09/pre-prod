package com.om.Real_Time_Communication.models;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_rooms")
@AllArgsConstructor
@Getter
@Setter
@Builder
public class ChatRoom {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String roomId; // UUID or composite of userIds
    @Column(name = "direct_pair_key", unique = true)
    private String directPairKey;
    private String name; // only for group chats
    private String description;        // Optional group bio
    private String imageUrl;

    private Boolean isGroup = true; // both group & meeting chats = true

    @Enumerated(EnumType.STRING)
    private ChatRoomType type; // GROUP or MEETING

    private Long meetingId;

    private String seriesId;

    private boolean allowMembersToEditMetadata = false;

    private boolean allowMembersToAddMembers = false;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;   // Track last metadata update

    /**
     * If a call is currently active in this room, store the call session id.
     * Null when no call is in progress.
     */
    private Long currentCallId;
    public ChatRoom() {}

    private ChatRoom(Builder b) {
        this.id = b.id;
        this.roomId = b.roomId;
        this.directPairKey = b.directPairKey;
        this.name = b.name;
        this.description = b.description;
        this.imageUrl = b.imageUrl;
        this.isGroup = b.isGroup;
        this.type = b.type;
        this.meetingId = b.meetingId;
        this.seriesId = b.seriesId;
        this.allowMembersToEditMetadata = b.allowMembersToEditMetadata;
        this.allowMembersToAddMembers = b.allowMembersToAddMembers;
        this.createdAt = b.createdAt;
        this.updatedAt = b.updatedAt;
        this.currentCallId = b.currentCallId;
    }

    public static Builder builder() { return new Builder(); }

    public Builder toBuilder() {
        return new Builder()
                .id(id)
                .roomId(roomId)
                .directPairKey(directPairKey)
                .name(name)
                .description(description)
                .imageUrl(imageUrl)
                .group(isGroup)
                .type(type)
                .meetingId(meetingId)
                .seriesId(seriesId)
                .allowMembersToEditMetadata(allowMembersToEditMetadata)
                .allowMembersToAddMembers(allowMembersToAddMembers)
                .createdAt(createdAt)
                .updatedAt(updatedAt)
                .currentCallId(currentCallId);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public String getDirectPairKey() {
        return directPairKey;
    }

    public void setDirectPairKey(String directPairKey) {
        this.directPairKey = directPairKey;
    }


    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public Boolean getGroup() {
        return isGroup;
    }

    public void setGroup(Boolean group) {
        isGroup = group;
    }

    public ChatRoomType getType() {
        return type;
    }

    public void setType(ChatRoomType type) {
        this.type = type;
    }

    public Long getMeetingId() {
        return meetingId;
    }

    public void setMeetingId(Long meetingId) {
        this.meetingId = meetingId;
    }

    public String getSeriesId() {
        return seriesId;
    }

    public void setSeriesId(String seriesId) {
        this.seriesId = seriesId;
    }

    public boolean isAllowMembersToEditMetadata() {
        return allowMembersToEditMetadata;
    }

    public void setAllowMembersToEditMetadata(boolean allowMembersToEditMetadata) {
        this.allowMembersToEditMetadata = allowMembersToEditMetadata;
    }

    public boolean isAllowMembersToAddMembers() {
        return allowMembersToAddMembers;
    }

    public void setAllowMembersToAddMembers(boolean allowMembersToAddMembers) {
        this.allowMembersToAddMembers = allowMembersToAddMembers;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Long getCurrentCallId() {
        return currentCallId;
    }

    public void setCurrentCallId(Long currentCallId) {
        this.currentCallId = currentCallId;
    }

    public static final class Builder {
        private Long id;
        private String roomId;
        private String directPairKey;
        private String name;
        private String description;
        private String imageUrl;
        private Boolean isGroup = true; // keep your default
        private ChatRoomType type;
        private Long meetingId;
        private String seriesId;
        private boolean allowMembersToEditMetadata = false;
        private boolean allowMembersToAddMembers = false;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private Long currentCallId;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder roomId(String roomId) { this.roomId = roomId; return this; }
        public Builder directPairKey(String directPairKey) { this.directPairKey = directPairKey; return this; }
        public Builder name(String name) { this.name = name; return this; }
        public Builder description(String description) { this.description = description; return this; }
        public Builder imageUrl(String imageUrl) { this.imageUrl = imageUrl; return this; }
        public Builder group(Boolean isGroup) { this.isGroup = isGroup; return this; }
        public Builder type(ChatRoomType type) { this.type = type; return this; }
        public Builder meetingId(Long meetingId) { this.meetingId = meetingId; return this; }
        public Builder seriesId(String seriesId) { this.seriesId = seriesId; return this; }
        public Builder allowMembersToEditMetadata(boolean v) { this.allowMembersToEditMetadata = v; return this; }
        public Builder allowMembersToAddMembers(boolean v) { this.allowMembersToAddMembers = v; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder updatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; return this; }
        public Builder currentCallId(Long currentCallId) { this.currentCallId = currentCallId; return this; }

        public ChatRoom build() { return new ChatRoom(this); }
    }

    // Getters / Setters (kept as in your class)
}
