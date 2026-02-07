
package com.om.backend.services;

import com.om.backend.Config.JwtConfig;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtBuilder;
import io.jsonwebtoken.Jwts;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.math.BigInteger;
import io.jsonwebtoken.security.SignatureException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.KeyFactory;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

@Service
public class JWTService implements OtpService.JwtSigner {

    private final JwtConfig cfg;
    private final RSAPrivateKey privateKey;
    private final RSAPublicKey currentPublic;
    private final @org.springframework.lang.Nullable RSAPublicKey previousPublicOrNull; // optional

    public JWTService(JwtConfig cfg,
                      RSAPrivateKey privateKey,
                      RSAPublicKey jwtCurrentPublicKey,
                      @org.springframework.lang.Nullable RSAPublicKey jwtPreviousPublicKey) {
        this.cfg = cfg;
        this.privateKey = privateKey;
        this.currentPublic = jwtCurrentPublicKey;
        this.previousPublicOrNull = jwtPreviousPublicKey;
    }

    private JwtBuilder baseBuilder(Instant now, Instant exp) {
        JwtBuilder builder = Jwts.builder()
                .header().keyId(cfg.getKid()).and()
                .issuer(cfg.getIssuer())
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp));
        if (cfg.getAudience() != null && !cfg.getAudience().isBlank()) {
            builder = builder.audience().add(cfg.getAudience()).and();
        }
        return builder;
    }

    // ---- Token creation ----

    /** Short-lived access token (TTL in minutes from config) */
    // keep name + params
    public String generateToken(CustomUserDetails user) {
        Instant now = Instant.now();
        Instant exp = now.plus(Duration.ofMinutes(cfg.getAccessTtlMin()));

        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", user.getId()); // keep your custom claim
        // Add more claims if needed (roles/tenant/etc.)

        return baseBuilder(now, exp)      // publish kid for verifiers (JWKS)
                .claims().add(claims).and()
                .subject(user.getUsername())              // subject = phone/username
                .signWith(privateKey, Jwts.SIG.RS256)     // RS256 with RSA private key
                .compact();
    }

    /** KEEP NAME + PARAMS — long-lived refresh token (TTL in days from config). */
    public String generateRefreshToken(UserDetails userDetails) {
        Instant now = Instant.now();
        Instant exp = now.plus(Duration.ofDays(cfg.getRefreshTtlDays()));

        return baseBuilder(now, exp)
                .subject(userDetails.getUsername())
                .signWith(privateKey, Jwts.SIG.RS256)     // RS256
                .compact();
    }

    // ---- Extraction & validation ----

    public String extractPhonenumber(String token) {
        // subject = your phone/username
        return extractClaim(token, Claims::getSubject);
    }

    /** Convenience alias if other code expects "username" */
    public String resolveUsernameFromPrincipal(Object principal) {
        if (principal == null) throw new IllegalArgumentException("principal is null");
        if (principal instanceof com.om.backend.services.CustomUserDetails cud) {
            return cud.getUsername(); // your CustomUserDetails
        }
        if (principal instanceof org.springframework.security.core.userdetails.UserDetails ud) {
            return ud.getUsername();
        }
        if (principal instanceof String s) {
            return s; // sometimes principal is a raw username
        }
        throw new IllegalArgumentException("Unsupported principal type: " + principal.getClass());
    }


    public boolean validToken(String token, UserDetails userDetails) {
        final String subject = extractPhonenumber(token);
        return subject.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    public boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    private <T> T extractClaim(String token, Function<Claims, T> claimResolver) {
        final Claims claims = extractAllClaims(token);
        return claimResolver.apply(claims);
    }

    /** Verify signature (current key), require issuer, then parse claims.
     *  If signature fails and a previous key is configured, try that (smooth rotation).
     */
    public Claims extractAllClaims(String token) {
        try {
            var parser = Jwts.parser()
                    .verifyWith(currentPublic)
                    .requireIssuer(cfg.getIssuer());
            if (cfg.getAudience() != null && !cfg.getAudience().isBlank()) {
                parser.requireAudience(cfg.getAudience());
            }
            return parser.build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (SignatureException e) {
            if (previousPublicOrNull == null) throw e;
            var parser = Jwts.parser()
                    .verifyWith(previousPublicOrNull)
                    .requireIssuer(cfg.getIssuer());
            if (cfg.getAudience() != null && !cfg.getAudience().isBlank()) {
                parser.requireAudience(cfg.getAudience());
            }
            return parser.build()
                    .parseSignedClaims(token)
                    .getPayload();
        }
    }

    // =======================
    // == KEY HELPERS (RSA) ==
    // =======================

    /** Derive the RSA public key (e=65537) from the private key's modulus. */
    private static RSAPublicKey derivePublicFromPrivate(RSAPrivateKey priv) {
        try {
            KeyFactory kf = KeyFactory.getInstance("RSA");
            RSAPublicKeySpec spec = new RSAPublicKeySpec(priv.getModulus(), BigInteger.valueOf(65537));
            return (RSAPublicKey) kf.generatePublic(spec);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to derive RSA public key from private key", e);
        }
    }

    /** Load previous public key from X.509 PEM if provided in config; else null. */
    private static RSAPublicKey loadPreviousPublic(String publicPem) {
        if (publicPem == null || publicPem.isBlank()) return null;
        try {
            String body = stripPem(publicPem, "PUBLIC KEY");
            byte[] der = Base64.getMimeDecoder().decode(body);
            KeyFactory kf = KeyFactory.getInstance("RSA");
            return (RSAPublicKey) kf.generatePublic(new X509EncodedKeySpec(der));
        } catch (Exception e) {
            throw new IllegalStateException("Invalid previous RSA PUBLIC KEY PEM", e);
        }
    }

    /** Utility for stripping PEM headers/footers and whitespace. */
    private static String stripPem(String pem, String type) {
        String p = pem.trim()
                .replace("-----BEGIN " + type + "-----", "")
                .replace("-----END " + type + "-----", "")
                .replaceAll("\\s", "");
        if (p.isEmpty()) throw new IllegalArgumentException("Empty PEM " + type);
        return p;
    }

    @Override
    public String signAccessToken(Long userId, String sessionId) {
        Instant now = Instant.now();
        Instant exp = now.plus(Duration.ofMinutes(cfg.getAccessTtlMin()));

        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("sid", sessionId);

        return baseBuilder(now, exp)
                .claims().add(claims).and()
                .subject(String.valueOf(userId))
                .signWith(privateKey, Jwts.SIG.RS256)
                .compact();
    }

    @Override
    public String signRefreshToken(Long userId, String sessionId) {
        Instant now = Instant.now();
        Instant exp = now.plus(Duration.ofDays(cfg.getRefreshTtlDays()));

        Map<String, Object> claims = new HashMap<>();
        claims.put("sid", sessionId);

        return baseBuilder(now, exp)
                .claims().add(claims).and()
                .subject(String.valueOf(userId))
                .signWith(privateKey, Jwts.SIG.RS256)
                .compact();
    }
}

