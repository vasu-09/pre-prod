package com.om.Real_Time_Communication.presence;

import lombok.AllArgsConstructor;
import lombok.Data;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class TypingRegistry {

    @Data
    public static class TypingKey { private Long roomId; private Long userId; private String deviceId;

        public TypingKey(Long roomId, Long userId, String deviceId) {
            this.roomId = roomId;
            this.userId = userId;
            this.deviceId = deviceId;
        }
    }
    @Data
    public static class Entry { private Instant expiresAt;

        public Entry(Instant expiresAt) {
            this.expiresAt = expiresAt;
        }

        public Instant getExpiresAt() {
            return expiresAt;
        }

        public void setExpiresAt(Instant expiresAt) {
            this.expiresAt = expiresAt;
        }
    }

    private final Map<TypingKey, Entry> map = new ConcurrentHashMap<TypingKey, Entry>();

    public Instant start(Long roomId, Long userId, String deviceId, long ttlMs) {
        Instant exp = Instant.now().plusMillis(ttlMs);
        map.put(new TypingKey(roomId, userId, deviceId), new Entry(exp));
        return exp;
    }

    public void stop(Long roomId, Long userId, String deviceId) {
        map.remove(new TypingKey(roomId, userId, deviceId));
    }

    @Scheduled(fixedDelay = 2000L)
    public void sweep() {
        Instant now = Instant.now();
        for (Map.Entry<TypingKey, Entry> e : map.entrySet()) {
            if (now.isAfter(e.getValue().getExpiresAt())) map.remove(e.getKey());
        }
    }
}
