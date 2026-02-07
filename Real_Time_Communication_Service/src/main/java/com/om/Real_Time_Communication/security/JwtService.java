package com.om.Real_Time_Communication.security;

import com.auth0.jwt.exceptions.JWTVerificationException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.stereotype.Service;

import com.om.Real_Time_Communication.config.RsJwtVerifier;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class JwtService {
    private final RsJwtVerifier verifier;
    public JwtService(RsJwtVerifier verifier) {
        this.verifier = verifier;
    }

    public Long parseUserId(String bearerOrToken) {
        Claims c = claims(bearerOrToken);
        Long userId = c.get("userId", Long.class);
        if (userId == null) throw new JWTVerificationException("userId missing");
        return userId;
    }

    public JwtIdentity parse(String bearerOrToken) {
        String token = stripBearerPrefix(bearerOrToken);
        Claims c = claims(bearerOrToken);
        Long userId = c.get("userId", Long.class);
        String tenant = c.get("tenant", String.class);
        List<String> rolesList = c.get("roles", List.class);
        Set<String> roles = rolesList != null ? new HashSet<>(rolesList) : Collections.emptySet();
        if (userId == null) throw new JWTVerificationException("userId missing");
        return new JwtIdentity(userId, roles, tenant);
    }

    private Claims claims(String bearerOrToken) {
        if (bearerOrToken == null || bearerOrToken.isBlank()) {
            throw new IllegalArgumentException("Missing token");
        }
        String token = stripBearerPrefix(bearerOrToken);
        try {
            return verifier.validate(token);
        } catch (JwtException e) {
            throw new JWTVerificationException(e.getMessage(), e);
        }
    }

    private String stripBearerPrefix(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.length() >= 6 && trimmed.regionMatches(true, 0, "bearer", 0, 6)) {
            int idx = 6;
            // tolerate optional separators between "Bearer" and the token (space/colon)
            while (idx < trimmed.length() && Character.isWhitespace(trimmed.charAt(idx))) idx++;
            if (idx < trimmed.length() && trimmed.charAt(idx) == ':') {
                idx++;
                while (idx < trimmed.length() && Character.isWhitespace(trimmed.charAt(idx))) idx++;
            }
            return trimmed.substring(idx).trim();
        }
        return trimmed;
    }

    public static final class JwtIdentity {
        private final Long userId;
        private final Set<String> roles;
        private final String tenant;

        public JwtIdentity(Long userId, Set<String> roles, String tenant) {
            this.userId = userId;
            this.roles = roles;
            this.tenant = tenant;
        }

        public Long getUserId() { return userId; }
        public Set<String> getRoles() { return roles; }
        public String getTenant() { return tenant; }
    }

}
