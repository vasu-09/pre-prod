package com.om.backend.Config;

import org.springframework.util.StringUtils;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.*;
import java.util.Base64;

public final class RsaKeys {
    private RsaKeys() {}

    public static RSAPrivateKey loadPrivatePkcs8Pem(String pem) {
        String body = stripPem(pem, "PRIVATE KEY");
        byte[] der = Base64.getMimeDecoder().decode(body);
        try {
            return (RSAPrivateKey) KeyFactory.getInstance("RSA")
                    .generatePrivate(new PKCS8EncodedKeySpec(der));
        } catch (Exception e) {
            throw new IllegalStateException("Invalid RSA PKCS#8 private key", e);
        }
    }

    public static RSAPublicKey loadPublicPem(String pem) {
        String body = stripPem(pem, "PUBLIC KEY");
        byte[] der = Base64.getMimeDecoder().decode(body);
        try {
            return (RSAPublicKey) KeyFactory.getInstance("RSA")
                    .generatePublic(new X509EncodedKeySpec(der));
        } catch (Exception e) {
            throw new IllegalStateException("Invalid RSA public key", e);
        }
    }

    private static String stripPem(String pem, String type) {
        String p = pem.trim()
                .replace("-----BEGIN " + type + "-----", "")
                .replace("-----END " + type + "-----", "")
                .replaceAll("\\s", "");
        if (!StringUtils.hasText(p)) throw new IllegalArgumentException("Empty PEM " + type);
        return p;
    }
}

