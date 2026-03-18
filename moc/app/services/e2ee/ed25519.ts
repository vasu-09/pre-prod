// app/services/e2ee/ed25519.ts   :contentReference[oaicite:0]{index=0}

import * as Crypto from 'expo-crypto';
import nacl from "tweetnacl";

export type Bytes = Uint8Array;

export interface Ed25519KeyPair {
  publicKey: Bytes;   // 32 bytes
  privateKey: Bytes;  // 32-byte seed
}

/**
 * Crypto-secure random bytes using Expo Random.
 */
export const randomBytes = (length: number): Bytes => {
  return Crypto.getRandomBytes(length);
};

/**
 * Generate a new Ed25519 key pair.
 * We store only the 32-byte seed as "privateKey".
 */
export const generateKeyPair = (): Ed25519KeyPair => {
  const seed = randomBytes(32); // 32-byte seed
  const keyPair = nacl.sign.keyPair.fromSeed(seed);

  return {
    publicKey: keyPair.publicKey, // 32 bytes
    privateKey: seed,             // 32-byte seed
  };
};

/**
 * Derive public key from seed.
 */
export const getPublicKey = (privateKey: Bytes): Bytes => {
  if (privateKey.length !== 32) {
    throw new Error("Private key must be a 32-byte seed");
  }
  return nacl.sign.keyPair.fromSeed(privateKey).publicKey;
};

/**
 * Sign message with Ed25519 using a 32-byte private seed.
 */
export const sign = (message: Bytes, privateKey: Bytes): Bytes => {
  if (privateKey.length !== 32) {
    throw new Error("Private key must be 32-byte seed");
  }
  const { secretKey } = nacl.sign.keyPair.fromSeed(privateKey);
  return nacl.sign.detached(message, secretKey);
};

/**
 * Verify signature.
 */
export const verify = (
  message: Bytes,
  signature: Bytes,
  publicKey: Bytes
): boolean => {
  return nacl.sign.detached.verify(message, signature, publicKey);
};
