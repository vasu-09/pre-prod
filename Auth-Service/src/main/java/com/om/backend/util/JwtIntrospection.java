package com.om.backend.util;


import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Base64;
import java.util.Optional;

public final class JwtIntrospection {
    private static final ObjectMapper M = new ObjectMapper();
    private JwtIntrospection() {}

    public static Optional<String> extractSid(String bearerOrJwt) { return claim(bearerOrJwt, "sid"); }
    public static Optional<String> extractJti(String bearerOrJwt) { return claim(bearerOrJwt, "jti"); }

    private static Optional<String> claim(String bearerOrJwt, String name) {
        try {
            String jwt = bearerOrJwt == null ? null :
                    (bearerOrJwt.startsWith("Bearer ") ? bearerOrJwt.substring(7) : bearerOrJwt);
            if (jwt == null || jwt.isBlank()) return Optional.empty();
            String[] parts = jwt.split("\\.");
            if (parts.length < 2) return Optional.empty();
            byte[] json = Base64.getUrlDecoder().decode(parts[1]);
            JsonNode n = M.readTree(json);
            JsonNode v = n.get(name);
            return (v == null || v.isNull()) ? Optional.empty() : Optional.of(v.asText());
        } catch (Exception e) {
            return Optional.empty();
        }
    }
    // extend your JwtIntrospection with exp/sub
    public static Optional<String> extractSub(String jwtOrBearer) { return claim(jwtOrBearer, "sub"); }
    public static Optional<Long>   extractExp(String jwtOrBearer) {
        return claim(jwtOrBearer, "exp").map(Long::valueOf);
    }
}
