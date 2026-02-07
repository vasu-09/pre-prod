package com.om.Real_Time_Communication.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwtException;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;
import java.util.Date;

@Component
public class RsJwtVerifier {

    private final RtcJwtConfig cfg;
    private final JwksCache jwks;

    public RsJwtVerifier(RtcJwtConfig cfg, JwksCache jwks) {
        this.cfg = cfg;
        this.jwks = jwks;
    }

    /** Public entrypoint used by JwtService (and indirectly by JwtHandshakeInterceptor). */
    public Claims validate(String token) {
        return extractAllClaims(token);
    }

    private RSAPublicKey keyForToken(String token) {
        String kid = headerKid(token);
        if (kid == null || kid.isBlank()) {
            throw new IllegalArgumentException("JWT missing kid");
        }
        RSAPublicKey pub = jwks.getKey(kid);
        if (pub == null) {
            throw new IllegalStateException("Unknown kid: " + kid);
        }
        return pub;
    }

    private Claims extractAllClaims(String token) {
        RSAPublicKey pub = keyForToken(token);
        var parser = Jwts.parser()
                .verifyWith(pub)
                .requireIssuer(cfg.getIssuer());
        if (cfg.getAudience() != null && !cfg.getAudience().isBlank()) {
            parser.requireAudience(cfg.getAudience());
        }
        Claims c = parser.build()
                .parseSignedClaims(token)
                .getPayload();

        Date exp = c.getExpiration();
        if (exp == null || exp.before(new Date())) {
            throw new JwtException("Expired");
        }
        return c;
    }

    private static String headerKid(String jwt) {
        String[] parts = jwt.split("\\.");
        if (parts.length < 2) return null;
        String json = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
        int idx = json.indexOf("\"kid\"");
        if (idx < 0) return null;
        int colon = json.indexOf(':', idx);
        int q1 = json.indexOf('"', colon + 1);
        int q2 = json.indexOf('"', q1 + 1);
        return (q1 > 0 && q2 > q1) ? json.substring(q1 + 1, q2) : null;
    }
}