package com.om.backend.Dto;

import com.om.backend.Model.UserSession;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

public final class SessionMappers {
    private SessionMappers() {}

    /** Map a single session to DTO, marking it current if IDs match. */
    public static SessionDto toDto(UserSession s, String currentSessionId) {
        Objects.requireNonNull(s, "session is null");

        SessionDto d = new SessionDto();
        d.setSessionId(s.getId());
        d.setDevice(s.getDeviceModel());
        d.setPlatform(s.getPlatform());
        d.setAppVersion(s.getAppVersion());
        d.setCreatedAt(s.getCreatedAt());
        d.setLastSeenAt(s.getLastSeenAt());
        d.setRevokedAt(s.getRevokedAt());
        d.setRefreshExpiresAt(s.getRefreshExpiresAt());

        boolean isCurrent = currentSessionId != null && currentSessionId.equals(s.getId());
        d.setCurrent(isCurrent);

        // pushEnabled = has FCM token AND session not revoked
        d.setPushEnabled(s.getFcmToken() != null && s.getRevokedAt() == null);

        return d;
    }

    /** Convenience mapper for lists. */
    public static List<SessionDto> toDtos(List<UserSession> sessions, String currentSessionId) {
        return sessions == null ? List.of()
                : sessions.stream().map(s -> toDto(s, currentSessionId)).collect(Collectors.toList());
    }
}
