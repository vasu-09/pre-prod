package com.om.Real_Time_Communication.service;

// TurnService.java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

@Service
public class TurnService {
    @Value("${turn.secret}") private String turnSecret;
    @Value("${turn.ttlSeconds:600}") private long ttlSeconds;
    @Value("${turn.urls}") private String urls; // comma list: stun:... , turn:...

    public Map<String,Object> creds(long userId) {
        long exp = Instant.now().getEpochSecond() + ttlSeconds;
        String username = exp + ":" + userId;
        String password = hmacSha1Base64(turnSecret, username);
        return Map.of(
                "username", username,
                "credential", password,
                "ttl", ttlSeconds,
                "urls", urls.split(",")
        );
    }

    private static String hmacSha1Base64(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA1"));
            return Base64.getEncoder().encodeToString(mac.doFinal(data.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}

