import { base64ToBytes, bigIntToBytes, bytesToBase64, bytesToBigInt } from './encoding';
import { randomBytes } from './random';

const PRIME = (1n << 256n) - 189n;
const GENERATOR = 5n;

export type DhKeyPair = {
  publicKey: string; // base64 encoded 32-byte big-endian representation
  privateKey: string; // base64 encoded 32-byte big-endian representation
};

const modPow = (base: bigint, exponent: bigint, modulus: bigint): bigint => {
  if (modulus === 1n) {
    return 0n;
  }
  let result = 1n;
  let b = base % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) {
      result = (result * b) % modulus;
    }
    e >>= 1n;
    b = (b * b) % modulus;
  }
  return result;
};

const randomScalar = (): bigint => {
  const bytes = randomBytes(32);
  const value = bytesToBigInt(bytes);
  const reduced = (value % (PRIME - 2n)) + 2n;
  return reduced;
};

export const generateDhKeyPair = (): DhKeyPair => {
  const priv = randomScalar();
  const pub = modPow(GENERATOR, priv, PRIME);
  return {
    publicKey: bytesToBase64(bigIntToBytes(pub, 32)),
    privateKey: bytesToBase64(bigIntToBytes(priv, 32)),
  };
};

export const deriveSharedSecret = (privateKeyB64: string, publicKeyB64: string): Uint8Array => {
  const priv = bytesToBigInt(base64ToBytes(privateKeyB64));
  const pub = bytesToBigInt(base64ToBytes(publicKeyB64));
  const shared = modPow(pub, priv, PRIME);
  return bigIntToBytes(shared, 32);
};

export const deriveEphemeral = (publicKeyB64: string): {
  shared: Uint8Array;
  ephemeralPublic: string;
  ephemeralSecret: string;
} => {
  const secret = randomScalar();
  const publicKey = modPow(GENERATOR, secret, PRIME);
  const target = bytesToBigInt(base64ToBytes(publicKeyB64));
  const shared = modPow(target, secret, PRIME);
  return {
    shared: bigIntToBytes(shared, 32),
    ephemeralPublic: bytesToBase64(bigIntToBytes(publicKey, 32)),
    ephemeralSecret: bytesToBase64(bigIntToBytes(secret, 32)),
  };
};

export const computeFromEphemeral = (privateKeyB64: string, ephemeralPublicB64: string): Uint8Array => {
  const priv = bytesToBigInt(base64ToBytes(privateKeyB64));
  const pub = bytesToBigInt(base64ToBytes(ephemeralPublicB64));
  const shared = modPow(pub, priv, PRIME);
  return bigIntToBytes(shared, 32);
};