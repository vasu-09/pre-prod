package com.om.Real_Time_Communication.security;

import java.security.*;

public final class Ed25519Verifier {
    private Ed25519Verifier() {}

    /** Verifies Ed25519 signature over data with raw 32-byte public key (RFC8032). */
    public static boolean verify(byte[] publicKey32, byte[] data, byte[] signature64) {
        try {
            if (publicKey32 == null || publicKey32.length != 32) return false;
            if (signature64 == null || signature64.length != 64) return false;
            KeyFactory kf = KeyFactory.getInstance("Ed25519");
            // X.509 SubjectPublicKeyInfo prefix for Ed25519 (12 bytes) + raw key
            // 302a300506032b6570032100 || 32 bytes
            byte[] prefix = new byte[] {
                    0x30,0x2a,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x03,0x21,0x00
            };
            byte[] spki = new byte[prefix.length + publicKey32.length];
            System.arraycopy(prefix,0,spki,0,prefix.length);
            System.arraycopy(publicKey32,0,spki,prefix.length,publicKey32.length);
            PublicKey pub = kf.generatePublic(new java.security.spec.X509EncodedKeySpec(spki));

            Signature sig = Signature.getInstance("Ed25519");
            sig.initVerify(pub);
            sig.update(data);
            return sig.verify(signature64);
        } catch (Exception e) {
            return false;
        }
    }
}
