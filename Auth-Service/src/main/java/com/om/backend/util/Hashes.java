package com.om.backend.util;


public final class Hashes {
    public static byte[] sha256(String s) {
        try {
            var d = java.security.MessageDigest.getInstance("SHA-256");
            return d.digest(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
}



