package com.om.Real_Time_Communication.utility;

import java.time.Instant;

public final class MessageCursor {
    public static String encode(Instant createdAt, Long id) {
        String raw = createdAt.toEpochMilli() + ":" + id;
        return java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
    public static java.util.AbstractMap.SimpleEntry<Instant, Long> decode(String token) {
        byte[] b = java.util.Base64.getUrlDecoder().decode(token);
        String s = new String(b, java.nio.charset.StandardCharsets.UTF_8);
        int i = s.indexOf(':');
        long ms = Long.parseLong(s.substring(0, i));
        long id = Long.parseLong(s.substring(i+1));
        return new java.util.AbstractMap.SimpleEntry<>(Instant.ofEpochMilli(ms), id);
    }
    private MessageCursor() {}
}
