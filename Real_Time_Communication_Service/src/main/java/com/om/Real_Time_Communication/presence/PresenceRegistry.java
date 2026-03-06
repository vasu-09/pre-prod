package com.om.Real_Time_Communication.presence;

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
        private String appState;
        private Long activeRoomId;

        public Presence(Long userId,
                        String deviceId,
                        Instant lastSeen,
                        boolean online,
                        String appState,
                        Long activeRoomId) {
            this.userId = userId;
            this.deviceId = deviceId;
            this.lastSeen = lastSeen;
            this.online = online;
            this.appState = appState;
            this.activeRoomId = activeRoomId;
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

        public String getAppState() {
            return appState;
        }

        public void setAppState(String appState) {
            this.appState = appState;
        }

        public Long getActiveRoomId() {
            return activeRoomId;
        }

        public void setActiveRoomId(Long activeRoomId) {
            this.activeRoomId = activeRoomId;
        }
    }

    // key: userId:deviceId
    private final Map<String, Presence> map = new ConcurrentHashMap<>();
    // heartbeat window (client sends every 15s, expire at 30s)
    private static final long EXPIRE_MS = 30_000L;

    public Presence touch(Long userId, String deviceId) {
        return touch(userId, deviceId, null);
    }

    public Presence touch(Long userId, String deviceId, Long activeRoomId) {
        String key = userId + ":" + deviceId;
        Presence p = map.get(key);
        if (p == null) {
            p = new Presence(userId, deviceId, Instant.now(), true, "FOREGROUND", activeRoomId);
            map.put(key, p);
        } else {
            p.setLastSeen(Instant.now());
            p.setOnline(true);
            p.setAppState("FOREGROUND");
            if (activeRoomId != null) {
                p.setActiveRoomId(activeRoomId);
            }
        }
        return p;
    }

    public Presence markOffline(Long userId, String deviceId) {
        String key = userId + ":" + deviceId;
        Presence p = map.get(key);
        if (p != null) {
            p.setOnline(false);
            p.setAppState("BACKGROUND");
            p.setActiveRoomId(null);
        }
        return p;
    }

    public void setActiveRoom(Long userId, String deviceId, Long roomId) {
        Presence p = touch(userId, deviceId, roomId);
        p.setActiveRoomId(roomId);
    }

    public void clearActiveRoom(Long userId, String deviceId, Long roomId) {
        String key = userId + ":" + deviceId;
        Presence p = map.get(key);
        if (p != null && java.util.Objects.equals(p.getActiveRoomId(), roomId)) {
            p.setActiveRoomId(null);
        }
    }

    public boolean isOnline(Long userId) {
        for (Presence p : map.values()) {
            if (userId.equals(p.getUserId()) && p.isOnline()) {
                return true;
            }
        }
        return false;
    }

    public boolean isViewingRoom(Long userId, Long roomId) {
        for (Presence p : map.values()) {
            if (userId.equals(p.getUserId())
                    && p.isOnline()
                    && java.util.Objects.equals(roomId, p.getActiveRoomId())) {
                return true;
            }
        }
        return false;
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
