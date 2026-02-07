package com.om.Real_Time_Communication.service;

import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

// TurnCredsService.java
@Service
public class TurnCredsService {
    // Match coturn static-auth-secret (DO NOT hardcode; load from env/secret mgr)
    private final String secret = System.getenv("TURN_SECRET");
    private final String[] urls = new String[] {
            "turn:turn.yourdomain.com:3478?transport=udp",
            "turn:turn.yourdomain.com:3478?transport=tcp"
            // add turns: for TLS if enabled
    };

    /** Produce username `expiry:userid` and HMAC-SHA1 password; ttlSec ~ 120–600 */
    public Map<String,Object> issue(Long userId, int ttlSec) {
        long expiry = (System.currentTimeMillis()/1000L) + ttlSec;
        String username = expiry + ":" + userId;
        String password = hmacSha1Base64(secret, username);
        Map<String,Object> m = new HashMap<String,Object>();
        m.put("username", username);
        m.put("credential", password);
        m.put("ttl", ttlSec);
        m.put("urls", urls);
        return m;
    }

    private static String hmacSha1Base64(String key, String data) {
        try {
            SecretKeySpec signingKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA1");
            Mac mac = Mac.getInstance("HmacSHA1"); mac.init(signingKey);
            return Base64.getEncoder().encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}

