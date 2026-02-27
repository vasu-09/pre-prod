package com.om.Real_Time_Communication.models;

import jakarta.persistence.*;


import java.time.Instant;

/** Message row with optional E2EE envelope; plaintext body only for non-E2EE rooms. */
@Entity
@Table(name = "chat_message",
        uniqueConstraints = @UniqueConstraint(name = "uq_room_message",
                columnNames = {"room_id","message_id"}))
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Routing / identity
    @Column(name = "room_id", nullable = false)
    private Long roomId;

    @Column(name = "sender_id", nullable = false)
    private Long senderId;

    // Idempotency (client-supplied ULID/UUIDv7)
    @Column(name = "message_id", nullable = false, length = 36)
    private String messageId;

    // Authoritative server timestamp
    @Column(name = "server_ts", nullable = false)
    private Instant serverTs = Instant.now();

    // ----- Non-E2EE (plaintext) -----
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private MessageType type;              // e.g., TEXT

    @Column(name = "body", columnDefinition = "text")
    private String body;                   // plaintext ONLY when e2ee=false

    // ----- E2EE envelope -----
    @Column(name = "e2ee", nullable = false)
    private boolean e2ee = false;

    @Column(name = "e2ee_ver")
    private Short e2eeVer;                 // protocol version, e.g., 1

    @Column(name = "algo", length = 16)
    private String algo;                   // "AES-GCM", etc.

    @Column(name = "aad", columnDefinition = "bytea")
    private byte[] aad;                    // associated data (optional)

    @Column(name = "iv", columnDefinition = "bytea")
    private byte[] iv;                     // nonce/iv

    @Column(name = "ciphertext", columnDefinition = "bytea")
    private byte[] ciphertext;             // encrypted payload (opaque to server)

    @Column(name = "key_ref", length = 64)
    private String keyRef;                 // "senderKey:v3" or per-recipient ref

    @Column(name = "deleted_by_sender", nullable = false)
    private boolean deletedBySender = false;

    @Column(name = "deleted_by_receiver", nullable = false)
    private boolean deletedByReceiver = false;

    @Column(name = "deleted_for_everyone", nullable = false)
    private boolean deletedForEveryone = false;

    @Column(name = "system_message", nullable = false)
    private boolean systemMessage = false;

    // ----- getters/setters -----
    public Long getId() { return id; }

    public Long getRoomId() { return roomId; }
    public void setRoomId(Long roomId) { this.roomId = roomId; }

    public Long getSenderId() { return senderId; }
    public void setSenderId(Long senderId) { this.senderId = senderId; }

    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }

    public Instant getServerTs() { return serverTs; }
    public void setServerTs(Instant serverTs) { this.serverTs = serverTs; }

    public MessageType getType() { return type; }
    public void setType(MessageType type) { this.type = type; }

    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }

    public boolean isE2ee() { return e2ee; }
    public void setE2ee(boolean e2ee) { this.e2ee = e2ee; }

    public Short getE2eeVer() { return e2eeVer; }
    public void setE2eeVer(Short e2eeVer) { this.e2eeVer = e2eeVer; }

    public String getAlgo() { return algo; }
    public void setAlgo(String algo) { this.algo = algo; }

    public byte[] getAad() { return aad; }
    public void setAad(byte[] aad) { this.aad = aad; }

    public byte[] getIv() { return iv; }
    public void setIv(byte[] iv) { this.iv = iv; }

    public byte[] getCiphertext() { return ciphertext; }
    public void setCiphertext(byte[] ciphertext) { this.ciphertext = ciphertext; }

    public String getKeyRef() { return keyRef; }
    public void setKeyRef(String keyRef) { this.keyRef = keyRef; }

    public boolean isDeletedBySender() { return deletedBySender; }
    public void setDeletedBySender(boolean deletedBySender) { this.deletedBySender = deletedBySender; }

    public boolean isDeletedByReceiver() { return deletedByReceiver; }
    public void setDeletedByReceiver(boolean deletedByReceiver) { this.deletedByReceiver = deletedByReceiver; }

    public boolean isDeletedForEveryone() { return deletedForEveryone; }
    public void setDeletedForEveryone(boolean deletedForEveryone) { this.deletedForEveryone = deletedForEveryone; }

    public boolean isSystemMessage() { return systemMessage; }
    public void setSystemMessage(boolean systemMessage) { this.systemMessage = systemMessage; }
}
