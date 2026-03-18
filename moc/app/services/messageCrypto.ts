import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import nacl from 'tweetnacl';
import { getStoredUserId, getStoredUsername } from './authStorage';
import {
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  hexToBytes,
  utf8ToBytes,
} from './e2ee/encoding';
import { createIntegrityStorage, normalizeSecureStoreKey, type StorageHandler } from './secureStorage';

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  aad?: string;
};

const seedPrng = () => {
  const applyRandom = (target: Uint8Array) => {
    const bytes = Crypto.getRandomBytes(target.length);
    target.set(bytes);
    return target;
  };

  const globalCrypto = (globalThis as any).crypto ?? {};
  if (typeof globalCrypto.getRandomValues !== 'function') {
    globalCrypto.getRandomValues = applyRandom;
    (globalThis as any).crypto = globalCrypto;
  }

  const setPrng = (nacl as unknown as { setPRNG?: (fn: (x: Uint8Array, n: number) => void) => void }).setPRNG;
  if (setPrng) {
    setPrng((x, n) => {
      const bytes = Crypto.getRandomBytes(n);
      x.set(bytes);
    });
  }
};

seedPrng();

const SHARED_KEY_PREFIX = 'chat.sharedKey:';
const SHARED_KEY_SALT_PREFIX = 'chat.sharedKeySalt:';
const SHARED_KEY_INDEX_KEY = 'chat.sharedKeyIndex';
const PBKDF2_ITERATIONS = 150_000;

const sharedKeyStorage: StorageHandler = Platform.OS === 'web'
  ? {
      getItem: key => AsyncStorage.getItem(key),
      setItem: (key, value) => AsyncStorage.setItem(key, value),
      removeItem: key => AsyncStorage.removeItem(key),
    }
  : createIntegrityStorage(
      {
        getItem: key => SecureStore.getItemAsync(key),
        setItem: (key, value) => SecureStore.setItemAsync(key, value),
        deleteItem: key => SecureStore.deleteItemAsync(key),
      },
      { normalizeKey: normalizeSecureStoreKey },
    );

const getStorageKey = (roomKey: string) => `${SHARED_KEY_PREFIX}${normalizeSecureStoreKey(roomKey)}`;
const getSalt = (roomKey: string) => `${SHARED_KEY_SALT_PREFIX}${normalizeSecureStoreKey(roomKey)}`;

const getTrackedRoomKeys = async (): Promise<string[]> => {
  const raw = await AsyncStorage.getItem(SHARED_KEY_INDEX_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
};

const trackRoomKey = async (roomKey: string): Promise<void> => {
  const normalized = normalizeSecureStoreKey(roomKey);
  const current = await getTrackedRoomKeys();
  if (current.includes(normalized)) {
    return;
  }
  await AsyncStorage.setItem(SHARED_KEY_INDEX_KEY, JSON.stringify([...current, normalized]));
};

const deriveWithSubtle = async (secret: string, salt: string) => {
  const textEncoder = new TextEncoder();
  const subtle = (globalThis as any)?.crypto?.subtle;
  if (!subtle) {
    return null;
  }

  const baseKey = await subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: textEncoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    nacl.secretbox.keyLength * 8,
  );

  return new Uint8Array(derivedBits);
};

const deriveSharedKey = async (roomKey: string): Promise<string> => {
  const userSecret = (await getStoredUsername()) ?? (await getStoredUserId()) ?? '';
  if (!userSecret) {
    throw new Error('Missing user credential for key derivation');
  }

  const salt = getSalt(roomKey);
  const derived =
    (await deriveWithSubtle(userSecret, salt)) ??
    hexToBytes(
      await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA512,
        `${userSecret}:${salt}:${PBKDF2_ITERATIONS}`,
      ),
    ).slice(0, nacl.secretbox.keyLength);

  return bytesToBase64(derived);
};

export const ensureSharedRoomKey = async (roomKey: string): Promise<string> => {
  const storageKey = getStorageKey(roomKey);
  const existing = await sharedKeyStorage.getItem(storageKey);
  if (existing) {
    await trackRoomKey(roomKey);
    return existing;
  }
  const derived = await deriveSharedKey(roomKey);
  await sharedKeyStorage.setItem(storageKey, derived);
  await trackRoomKey(roomKey);
  return derived;
};

export const clearChatCryptoState = async (): Promise<void> => {
  const trackedRoomKeys = await getTrackedRoomKeys();
  const normalizedKeys = new Set(trackedRoomKeys.map(value => normalizeSecureStoreKey(value)));

  if (Platform.OS === 'web') {
    const allKeys = await AsyncStorage.getAllKeys();
    allKeys.forEach(key => {
      if (key.startsWith(SHARED_KEY_PREFIX)) {
        normalizedKeys.add(key.slice(SHARED_KEY_PREFIX.length));
      } else if (key.startsWith(SHARED_KEY_SALT_PREFIX)) {
        normalizedKeys.add(key.slice(SHARED_KEY_SALT_PREFIX.length));
      }
    });
  }

  await Promise.all(
    Array.from(normalizedKeys).flatMap(normalizedRoomKey => [
      sharedKeyStorage.removeItem(`${SHARED_KEY_PREFIX}${normalizedRoomKey}`),
      sharedKeyStorage.removeItem(`${SHARED_KEY_SALT_PREFIX}${normalizedRoomKey}`),
    ]),
  );

  await AsyncStorage.removeItem(SHARED_KEY_INDEX_KEY);
};

export const decryptMessage = async (
  payload: EncryptedPayload,
  sharedKeyB64: string,
): Promise<string> => {
  try {
    const key = base64ToBytes(sharedKeyB64);
    if (key.length !== nacl.secretbox.keyLength) {
      throw new Error('Invalid key length');
    }
    const iv = base64ToBytes(payload.iv);
    if (iv.length !== nacl.secretbox.nonceLength) {
      throw new Error('Invalid nonce length');
    }
    const cipher = base64ToBytes(payload.ciphertext);
    const opened = nacl.secretbox.open(cipher, iv, key);
    if (!opened) {
      throw new Error('Unable to authenticate ciphertext');
    }
    return bytesToUtf8(opened);
  } catch (err) {
    const failureMeta = {
      aadPresent: Boolean(payload.aad),
      cipherLength: payload.ciphertext?.length ?? 0,
      ivLength: payload.iv?.length ?? 0,
      keyLength: sharedKeyB64?.length ?? 0,
      reason: err instanceof Error ? err.message : 'unknown',
    };
    console.warn('[crypto] failed to decrypt message', failureMeta, err);
    throw err;
  }
};

export const encryptMessage = async (
  plaintext: string,
  sharedKeyB64: string,
): Promise<EncryptedPayload> => {
  const key = base64ToBytes(sharedKeyB64);
  if (key.length !== nacl.secretbox.keyLength) {
    throw new Error('Invalid key length');
  }
  const iv = nacl.randomBytes(nacl.secretbox.nonceLength);
  const cipher = nacl.secretbox(utf8ToBytes(plaintext), iv, key);
  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(cipher),
  };
};