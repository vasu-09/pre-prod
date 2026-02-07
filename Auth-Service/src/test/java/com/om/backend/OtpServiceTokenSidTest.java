package com.om.backend;

import com.om.backend.Config.JwtConfig;
import com.om.backend.services.JWTService;
import com.om.backend.services.OtpService;
import com.om.backend.util.JwtIntrospection;
import org.junit.jupiter.api.Test;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Clock;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class OtpServiceTokenSidTest {

    @Test
    public void mintedTokensContainSid() throws Exception {
        JwtConfig cfg = new JwtConfig();
        cfg.setKid("test-kid");
        cfg.setIssuer("test-issuer");
        cfg.setAccessTtlMin(5);
        cfg.setRefreshTtlDays(7);

        KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
        kpg.initialize(2048);
        KeyPair kp = kpg.generateKeyPair();
        RSAPrivateKey priv = (RSAPrivateKey) kp.getPrivate();
        RSAPublicKey pub = (RSAPublicKey) kp.getPublic();

        JWTService jwtService = new JWTService(cfg, priv, pub, null);

        OtpService otpService = new OtpService(
                null, null, null, null, null, null,
                jwtService,
                Clock.systemUTC()
        );

        Long userId = 123L;
        String sessionId = "session-xyz";
        String access = otpService.mintAccessToken(userId, sessionId);
        String refresh = otpService.mintRefreshToken(userId, sessionId);

        assertEquals(sessionId, JwtIntrospection.extractSid(access).orElse(null));
        assertEquals(sessionId, JwtIntrospection.extractSid(refresh).orElse(null));
    }
}
