package com.om.Real_Time_Communication.presence;

import lombok.AllArgsConstructor;
import lombok.Data;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class PresenceRegistry {
    @Data
    public static class Presence {
        private Long userId;
        private String deviceId;
        private Instant lastSeen;
        private boolean online;

        public Presence(Long userId, String deviceId, Instant lastSeen, boolean online) {
            this.userId = userId;
            this.deviceId = deviceId;
            this.lastSeen = lastSeen;
            this.online = online;
        }

        public Long getUserId() {
            return userId;
        }

        public void setUserId(Long userId) {
            this.userId = userId;
        }

        public String getDeviceId() {
            return deviceId;
        }

        public void setDeviceId(String deviceId) {
            this.deviceId = deviceId;
        }

        public Instant getLastSeen() {
            return lastSeen;
        }

        public void setLastSeen(Instant lastSeen) {
            this.lastSeen = lastSeen;
        }

        public boolean isOnline() {
            return online;
        }

        public void setOnline(boolean online) {
            this.online = online;
        }
    }

    // key: userId:deviceId
    private final Map<String, Presence> map = new ConcurrentHashMap<>();
    // heartbeat window (client sends every 15s, expire at 30s)
    private static final long EXPIRE_MS = 30_000L;

    public Presence touch(Long userId, String deviceId) {
        String key = userId + ":" + deviceId;
        Presence p = map.get(key);
        if (p == null) {
            p = new Presence(userId, deviceId, Instant.now(), true);
            map.put(key, p);
        } else {
            p.setLastSeen(Instant.now());
            p.setOnline(true);
        }
        return p;
    }

    public Presence markOffline(Long userId, String deviceId) {
        String key = userId + ":" + deviceId;
        Presence p = map.get(key);
        if (p != null) p.setOnline(false);
        return p;
    }

    public List<Presence> snapshotForUser(Long userId) {
        List<Presence> out = new ArrayList<Presence>();
        for (Presence p : map.values()) if (p.getUserId().equals(userId)) out.add(p);
        return out;
    }

    /** Sweep every 10s; mark offline if lastSeen is stale (> 2 * heartbeat). */
    @Scheduled(fixedDelay = 10_000L)
    public void sweep() {
        Instant now = Instant.now();
        for (Presence p : map.values()) {
            if (p.isOnline() && now.toEpochMilli() - p.getLastSeen().toEpochMilli() > EXPIRE_MS) {
                p.setOnline(false);
            }
        }
    }
}
