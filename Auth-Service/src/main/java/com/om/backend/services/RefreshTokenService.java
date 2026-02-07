package com.om.backend.services;

import com.om.backend.Model.RefreshTokenEntity;
import com.om.backend.Repositories.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    @Autowired
    private  RefreshTokenRepository repo;
    @Autowired
    private  UserService userService; // to map phone -> user, or pass userId directly

    /** Issue a new refresh token bound to a specific device (registrationId + deviceId). */
    public Map<String, Object> issue(Long userId, int registrationId, int deviceId, Duration ttl) {
        String raw = uuidToken();                  // random string presented to client
        String hash = sha256(raw);                 // store only hash

        RefreshTokenEntity e = new RefreshTokenEntity();
        e.setUserId(userId);
        e.setRegistrationId(registrationId);
        e.setDeviceId(deviceId);
        e.setTokenHash(hash);
        e.setCreatedAt(Instant.now());
        e.setExpiresAt(Instant.now().plus(ttl));
        repo.save(e);

        return Map.of(
                "raw", raw,                // return to client once
                "expiresAt", e.getExpiresAt(),
                "id", e.getId()
        );
    }

    /** Verify incoming refresh token and rotate (invalidate old, issue new). */
    public Map<String, Object> verifyAndRotate(String rawToken,
                                               int registrationId,
                                               int deviceId,
                                               Duration ttl) {
        String hash = sha256(rawToken);
        RefreshTokenEntity current = repo.findByTokenHashAndRevokedFalse(hash)
                .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));

        if (current.getExpiresAt().isBefore(Instant.now()))
            throw new IllegalArgumentException("Refresh token expired");

        // Enforce device binding
        if (current.getRegistrationId() != registrationId || current.getDeviceId() != deviceId)
            throw new IllegalArgumentException("Token not valid for this device");

        // rotate
        current.setRevoked(true);
        repo.save(current);

        var next = issue(current.getUserId(), registrationId, deviceId, ttl);
        // chain (optional)
        current.setReplacedByTokenId((Long) next.get("id"));
        repo.save(current);

        return next; // contains "raw" for client
    }

    /** Revoke all tokens for a device (logout all for that device). */
    public long revokeAllForDevice(Long userId, int registrationId, int deviceId) {
        return repo.deleteByUserIdAndDeviceIdAndRegistrationId(userId, deviceId, registrationId);
    }

    /** housekeeping */
    public long cleanupExpired(Long userId) {
        return repo.deleteByUserIdAndExpiresAtBefore(userId, Instant.now());
    }

    private static String uuidToken() { return UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID(); }

    private static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] dig = md.digest(s.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(dig);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}