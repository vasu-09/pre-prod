// src/main/java/com/om/backend/Config/JwtKeyProvider.java
package com.om.backend.Config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.math.BigInteger;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Arrays;
import java.util.Base64;

@Configuration
public class JwtKeyProvider {

    @Bean
    public RSAPrivateKey jwtPrivateKey(JwtConfig cfg) {
        String pem = cfg.getPrivateKeyPem();
        if (pem == null || pem.isBlank()) {
            throw new IllegalStateException("JWT private key is not configured");
        }

        pem = pem.replaceAll("\r", "").trim();
        try {
            KeyFactory kf = KeyFactory.getInstance("RSA");
            String body;
            byte[] der;

            if (pem.contains("BEGIN RSA PRIVATE KEY")) {
                body = pem.replace("-----BEGIN RSA PRIVATE KEY-----", "")
                        .replace("-----END RSA PRIVATE KEY-----", "")
                        .replaceAll("\\s", "");
                byte[] pkcs1 = Base64.getMimeDecoder().decode(body);
                der = pkcs1ToPkcs8(pkcs1);
            } else {
                body = pem.replace("-----BEGIN PRIVATE KEY-----", "")
                        .replace("-----END PRIVATE KEY-----", "")
                        .replaceAll("\\s", "");
                der = Base64.getMimeDecoder().decode(body);
            }

            return (RSAPrivateKey) kf.generatePrivate(new PKCS8EncodedKeySpec(der));
        } catch (Exception e) {
            throw new IllegalStateException("Invalid RSA private key", e);
        }
    }

    private static byte[] pkcs1ToPkcs8(byte[] pkcs1) {
        // PKCS#8 header for RSA keys (ASN.1 sequence)
        final byte[] header = {
                0x30, (byte) 0x82, (byte) ((pkcs1.length + 22) >> 8), (byte) ((pkcs1.length + 22) & 0xff),
                0x02, 0x01, 0x00,
                0x30, 0x0d,
                0x06, 0x09, 0x2a, (byte) 0x86, 0x48, (byte) 0x86, (byte) 0xf7, 0x0d, 0x01, 0x01, 0x01,
                0x05, 0x00,
                0x04, (byte) 0x82, (byte) (pkcs1.length >> 8), (byte) (pkcs1.length & 0xff)
        };
        byte[] pkcs8 = Arrays.copyOf(header, header.length + pkcs1.length);
        System.arraycopy(pkcs1, 0, pkcs8, header.length, pkcs1.length);
        return pkcs8;
    }

    // Current public key (derived from private; e = 65537)
    @Bean
    public RSAPublicKey jwtCurrentPublicKey(RSAPrivateKey priv) {
        try {
            var kf = KeyFactory.getInstance("RSA");
            return (RSAPublicKey) kf.generatePublic(
                    new RSAPublicKeySpec(priv.getModulus(), BigInteger.valueOf(65537)));
        } catch (Exception e) {
            throw new IllegalStateException("Failed to derive RSA public key", e);
        }
    }

    // Optional: previous public key from PEM (if you use rotation)
    @Bean
    public RSAPublicKey jwtPreviousPublicKey(JwtConfig cfg) {
        String pem = cfg.getPreviousPublicPem();
        if (pem == null || pem.isBlank()) return null; // Spring will inject null if requested with @Nullable
        String body = pem.replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");
        byte[] der = Base64.getMimeDecoder().decode(body);
        try {
            return (RSAPublicKey) KeyFactory.getInstance("RSA")
                    .generatePublic(new X509EncodedKeySpec(der));
        } catch (Exception e) {
            throw new IllegalStateException("Invalid previous RSA PUBLIC KEY PEM", e);
        }
    }
}


