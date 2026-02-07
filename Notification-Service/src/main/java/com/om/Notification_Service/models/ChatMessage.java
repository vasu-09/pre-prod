package com.om.Notification_Service.models;

import com.om.Notification_Service.dto.MessageType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "chat_messages")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long roomId;                   // FK to ChatRoom.id

    private Long senderId;                 // user who “sent” this (creator for SYSTEM)

    @Enumerated(EnumType.STRING)
    private MessageType type;              // e.g. TEXT, IMAGE, SYSTEM, etc.

    @Column(columnDefinition = "TEXT")
    private String content;                // message text or system notification

    private Instant timestamp;
}

