package com.om.Real_Time_Communication.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "messages")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Setter
public class Message {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Client generated unique identifier to provide idempotency
     * and deduplication of message deliveries.
     */
    @Column(unique = true)
    private String messageId;

    private String senderId;
    private String receiverId; // could be userId or groupId

    @Enumerated(EnumType.STRING)
    private MessageType type; // TEXT, IMAGE, FILE, VIDEO_CALL_INVITE, etc.

    private String content;

    private String metadata;
    private LocalDateTime timestamp;

    private Boolean isGroupMessage;

    private boolean deletedBySender = false;
    private boolean deletedByReceiver = false;

    private boolean deletedForEveryone;

    private boolean systemMessage = false;

    @ElementCollection
    private Set<String> deletedByUserIds = new HashSet<>();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }

    public String getSenderId() {
        return senderId;
    }

    public void setSenderId(String senderId) {
        this.senderId = senderId;
    }

    public String getReceiverId() {
        return receiverId;
    }

    public void setReceiverId(String receiverId) {
        this.receiverId = receiverId;
    }

    public MessageType getType() {
        return type;
    }

    public void setType(MessageType type) {
        this.type = type;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public Boolean getGroupMessage() {
        return isGroupMessage;
    }

    public void setGroupMessage(Boolean groupMessage) {
        isGroupMessage = groupMessage;
    }

    public boolean isDeletedBySender() {
        return deletedBySender;
    }

    public void setDeletedBySender(boolean deletedBySender) {
        this.deletedBySender = deletedBySender;
    }

    public boolean isDeletedByReceiver() {
        return deletedByReceiver;
    }

    public void setDeletedByReceiver(boolean deletedByReceiver) {
        this.deletedByReceiver = deletedByReceiver;
    }

    public boolean isDeletedForEveryone() {
        return deletedForEveryone;
    }

    public void setDeletedForEveryone(boolean deletedForEveryone) {
        this.deletedForEveryone = deletedForEveryone;
    }

    public boolean isSystemMessage() {
        return systemMessage;
    }

    public void setSystemMessage(boolean systemMessage) {
        this.systemMessage = systemMessage;
    }

    public Set<String> getDeletedByUserIds() {
        return deletedByUserIds;
    }

    public void setDeletedByUserIds(Set<String> deletedByUserIds) {
        this.deletedByUserIds = deletedByUserIds;
    }
}