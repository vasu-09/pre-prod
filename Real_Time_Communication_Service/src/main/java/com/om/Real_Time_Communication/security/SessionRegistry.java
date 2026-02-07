package com.om.Real_Time_Communication.security;

import io.micrometer.common.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.util.Collections;
import java.util.Set;
import java.util.HashSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

// SessionRegistry.java
@Component
public class SessionRegistry {

    private final ConcurrentMap<String, WebSocketSession> bySession = new ConcurrentHashMap<>();
    private final ConcurrentMap<Long, Set<String>> sessionsByUser = new ConcurrentHashMap<>();

    public void onOpen(Long userId, WebSocketSession s) {
        bySession.put(s.getId(), s);
        sessionsByUser.computeIfAbsent(userId, k -> Collections.newSetFromMap(new ConcurrentHashMap<String, Boolean>()))
                .add(s.getId());
    }

    public void onClose(WebSocketSession s, @Nullable Long userId) {
        bySession.remove(s.getId());
        if (userId != null) {
            Set<String> set = sessionsByUser.get(userId);
            if (set != null) {
                set.remove(s.getId());
                if (set.isEmpty()) sessionsByUser.remove(userId);
            }
        }
    }

    /** Return true if the user has at least one open session. */
    public boolean hasActive(Long userId) {
        Set<String> ids = sessionsByUser.get(userId);
        if (ids == null || ids.isEmpty()) return false;
        for (String sid : ids) {
            WebSocketSession s = bySession.get(sid);
            if (s != null && s.isOpen()) return true;
        }
        return false;
    }

    /**
     * Return all currently known sessions for the given user. The returned set only
     * contains sessions that are still open at the time of the call.
     */
    public Set<WebSocketSession> getSessions(Long userId) {
        Set<String> ids = sessionsByUser.get(userId);
        if (ids == null || ids.isEmpty()) return Collections.emptySet();
        Set<WebSocketSession> sessions = new HashSet<>();
        for (String sid : ids) {
            WebSocketSession s = bySession.get(sid);
            if (s != null && s.isOpen()) {
                sessions.add(s);
            }
        }
        return sessions;
    }

    /** Close all open sessions for userId, return how many were closed. */
    public int kickUser(Long userId, String reason) {
        Set<String> ids = sessionsByUser.get(userId);
        if (ids == null) return 0;
        int n = 0;
        for (String sid : ids) {
            WebSocketSession s = bySession.get(sid);
            if (s != null && s.isOpen()) {
                try {
                    s.close(CloseStatus.NORMAL.withReason(reason));
                    n++;
                } catch (Exception ignore) {}
            }
        }
        return n;
    }
}
