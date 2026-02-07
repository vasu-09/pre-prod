package com.om.To_Do.List.ecosystem.services;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Utility component to encrypt/decrypt sensitive payment tokens before
 * persisting them. Uses a simple AES key supplied via configuration so that
 * only token identifiers are stored, not raw payment details.
 */
@Component
public class TokenEncryptor {

    private final String secret;

    public TokenEncryptor(@Value("${payment.token.secret:0123456789abcdef}") String secret) {
        this.secret = secret;
    }

    public String encrypt(String plain) {
        try {
            Cipher cipher = Cipher.getInstance("AES");
            SecretKeySpec keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "AES");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec);
            byte[] encrypted = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(encrypted);
        } catch (Exception e) {
            throw new RuntimeException("Unable to encrypt token", e);
        }
    }

    public String decrypt(String encoded) {
        try {
            Cipher cipher = Cipher.getInstance("AES");
            SecretKeySpec keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "AES");
            cipher.init(Cipher.DECRYPT_MODE, keySpec);
            byte[] decoded = Base64.getDecoder().decode(encoded);
            byte[] decrypted = cipher.doFinal(decoded);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("Unable to decrypt token", e);
        }
    }
}
