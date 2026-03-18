import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { createIntegrityStorage, normalizeSecureStoreKey } from '../secureStorage';

// Expo SecureStore only accepts alphanumeric characters plus ".", "-" and "_" in keys.
// Colon was causing `Invalid key provided to SecureStore` on native platforms, so
// replace it with a compatible separator. Keep a legacy key for web-only migration.
const STORAGE_KEY = 'e2ee.device-state.v1';
const LEGACY_STORAGE_KEY = 'e2ee:device-state:v1';

const secureHandler = createIntegrityStorage(
  {
    getItem: key => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    deleteItem: key => SecureStore.deleteItemAsync(key),
  },
  { normalizeKey: normalizeSecureStoreKey },
);

 const asyncHandler = createIntegrityStorage({
  getItem: key => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  deleteItem: key => AsyncStorage.removeItem(key),
}, { chunkSize: 0 });

const deviceStorage = Platform.OS === 'web' ? asyncHandler : secureHandler;



export type StoredPrekey = {
  prekeyId?: number;
  publicKey: string;
  privateKey: string;
  uploaded: boolean;
  consumed?: boolean;
  consumedAt?: number;
  createdAt: number;
};

export type SentMessageKey = {
  messageId: string;
  key: string;
  createdAt: number;
};

export type PeerFingerprint = {
  deviceId: string;
  identityKey: string;
  signedPrekey: string;
  updatedAt: number;
};

export type DeviceState = {
  version: number;
  deviceId: string;
  identity: {
    publicKey: string;
    privateKey: string;
  };
  signedPrekey: {
    publicKey: string;
    privateKey: string;
    signature: string | null;
  };
  oneTimePrekeys: StoredPrekey[];
  sentMessageKeys: SentMessageKey[];
  lastRegisteredAt?: number;
  peerFingerprints?: Record<number, PeerFingerprint>;
};

export const loadDeviceState = async (): Promise<DeviceState | null> => {
  const safeGet = async (key: string) => {
    try {
      return await deviceStorage.getItem(key);
    } catch {
      return null;
    }
    };

  // Read from the new key first; fall back to legacy key on web (AsyncStorage) only.
  const rawFromNewKey = await safeGet(STORAGE_KEY);
  const raw =
    rawFromNewKey ?? (Platform.OS === 'web' ? await asyncHandler.getItem(LEGACY_STORAGE_KEY) : null);

  if (!raw) {
    return null;
  }

  if (!rawFromNewKey && Platform.OS === 'web') {
    // Migrate legacy value to the new key for future reads.
    await deviceStorage.setItem(STORAGE_KEY, raw);
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      await deviceStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed as DeviceState;
  } catch {
    await deviceStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const saveDeviceState = async (state: DeviceState): Promise<void> => {
  const payload = JSON.stringify(state);
  await deviceStorage.setItem(STORAGE_KEY, payload)
};

export const updateDeviceState = async (updater: (current: DeviceState | null) => DeviceState): Promise<DeviceState> => {
  const current = await loadDeviceState();
  const next = updater(current);
  await saveDeviceState(next);
  return next;
};
