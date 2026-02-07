package com.om.Notification_Service.dto;

import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageDto {
    private String id;        // or Long id, if you prefer
    private Long roomId;
    private Long senderId;
    private MessageType type;
    private String content;
    private Instant timestamp;


    // Private ctor used by the builder
    private ChatMessageDto(Builder b) {
        this.id = b.id;
        this.roomId = b.roomId;
        this.senderId = b.senderId;
        this.type = b.type;
        this.content = b.content;
        this.timestamp = b.timestamp;
    }

    // ---- Builder API ----
    public static Builder builder() { return new Builder(); }

    public Builder toBuilder() {
        return new Builder()
                .id(this.id)
                .roomId(this.roomId)
                .senderId(this.senderId)
                .type(this.type)
                .content(this.content)
                .timestamp(this.timestamp);
    }

    public static final class Builder {
        private String id;
        private Long roomId;
        private Long senderId;
        private MessageType type;
        private String content;
        private Instant timestamp;

        public Builder id(String id) { this.id = id; return this; }
        public Builder roomId(Long roomId) { this.roomId = roomId; return this; }
        public Builder senderId(Long senderId) { this.senderId = senderId; return this; }
        public Builder type(MessageType type) { this.type = type; return this; }
        public Builder content(String content) { this.content = content; return this; }
        public Builder timestamp(Instant timestamp) { this.timestamp = timestamp; return this; }

        public ChatMessageDto build() {
            // Optional: minimal validation
            // if (roomId == null) throw new IllegalStateException("roomId is required");
            // if (senderId == null) throw new IllegalStateException("senderId is required");
            return new ChatMessageDto(this);
        }
    }

    // ---- Getters & Setters (replace Lombok @Data) ----
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Long getRoomId() { return roomId; }
    public void setRoomId(Long roomId) { this.roomId = roomId; }

    public Long getSenderId() { return senderId; }
    public void setSenderId(Long senderId) { this.senderId = senderId; }

    public MessageType getType() { return type; }
    public void setType(MessageType type) { this.type = type; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
}
