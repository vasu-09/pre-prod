package com.om.backend.Model;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "user_chat_prefs")
@IdClass(UserChatPrefs.Key.class)
public class UserChatPrefs {

    @Id
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Id
    @Column(name = "chat_id", nullable = false)
    private Long chatId;

    @Column(name = "muted_until") // null = not muted
    private Instant mutedUntil;

    // --- getters/setters ---
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getChatId() { return chatId; }
    public void setChatId(Long chatId) { this.chatId = chatId; }
    public Instant getMutedUntil() { return mutedUntil; }
    public void setMutedUntil(Instant mutedUntil) { this.mutedUntil = mutedUntil; }

    // ---------- Composite key ----------
    public static class Key implements Serializable {
        private Long userId;
        private Long chatId;
        public Key() {}
        public Key(Long userId, Long chatId) { this.userId = userId; this.chatId = chatId; }
        @Override public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Key k)) return false;
            return Objects.equals(userId, k.userId) && Objects.equals(chatId, k.chatId);
        }
        @Override public int hashCode() { return Objects.hash(userId, chatId); }
    }
}
