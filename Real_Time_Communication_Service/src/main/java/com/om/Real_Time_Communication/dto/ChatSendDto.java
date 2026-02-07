package com.om.Real_Time_Communication.dto;

import com.om.Real_Time_Communication.models.MessageType;

public class ChatSendDto {

    // Always provided
    private String messageId;           // ULID/UUIDv7 (client-generated)
    private MessageType type;           // e.g., TEXT (still helpful for UI / analytics)

    // For non-E2EE rooms only:
    private String body;                // plaintext (MUST be null when e2ee=true)

    // E2EE envelope (when e2ee = true)
    private boolean e2ee;               // true if payload is encrypted
    private Short e2eeVer;              // protocol version (e.g., 1)
    private String algo;                // "AES-GCM"
    private byte[] aad;                 // optional associated data
    private byte[] iv;                  // nonce
    private byte[] ciphertext;          // opaque bytes
    private String keyRef;              // "senderKey:v3" or per-recipient reference

    // getters/setters

    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }

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
}

