import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { createIntegrityStorage, normalizeSecureStoreKey, type StorageHandler } from './secureStorage';

const ACCESS_TOKEN_KEY = 'auth.accessToken';
const REFRESH_TOKEN_KEY = 'auth.refreshToken';
const SESSION_ID_KEY = 'auth.sessionId';
const USER_ID_KEY = 'auth.userId';
const USERNAME_KEY = 'auth.username';
const ISSUED_AT_KEY = 'auth.issuedAt';

type NullableString = string | null | undefined;

type WebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const isWeb = Platform.OS === 'web';
const useSecureStore = !isWeb;

const secureStoreHandler: StorageHandler = createIntegrityStorage(
  {
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    getItem: key => SecureStore.getItemAsync(key),
    deleteItem: key => SecureStore.deleteItemAsync(key),
  },
  { normalizeKey: normalizeSecureStoreKey },
);

const asyncStorageHandler: StorageHandler = {
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  getItem: (key) => AsyncStorage.getItem(key),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

const getLocalStorage = (): WebStorage | null => {
  try {
    if (typeof window !== 'undefined' && window?.localStorage) {
      return window.localStorage as WebStorage;
    }
  } catch {
    return null;
  }

  return null;
};

const localStorageHandler: StorageHandler = {
  setItem: async (key, value) => {
    const localStorage = getLocalStorage();
    if (localStorage) {
      localStorage.setItem(key, value);
      return;
    }

    await asyncStorageHandler.setItem(key, value);
  },
  getItem: async (key) => {
    const localStorage = getLocalStorage();
    if (localStorage) {
      return localStorage.getItem(key);
    }

    return asyncStorageHandler.getItem(key);
  },
  removeItem: async (key) => {
    const localStorage = getLocalStorage();
    if (localStorage) {
      localStorage.removeItem(key);
      return;
    }

    await asyncStorageHandler.removeItem(key);
  },
};

const storage: StorageHandler = useSecureStore ? secureStoreHandler : localStorageHandler;

const setItem = async (key: string, value: NullableString) => {
  if (value === undefined) {
    return;
  }

  if (value === null) {
    await storage.removeItem(key);
    return;
  }

  await storage.setItem(key, value);
};

const getItem = async (key: string) => storage.getItem(key);

export type StoredSession = {
  accessToken: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  userId: string | null;
  username: string | null;
  issuedAt: string | null;
};

type JwtPayload = Record<string, unknown> | null;

const decodeJwtPayload = (token: NullableString): JwtPayload => {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength = (4 - (base64.length % 4)) % 4;
  const padded = `${base64}${'='.repeat(paddingLength)}`;

  const decodeBase64 = () => {
    try {
      const atobFn = (typeof globalThis !== 'undefined' && globalThis.atob) || undefined;
      if (atobFn) {
        const binary = atobFn(padded);
        const bytes = Array.from(binary).map((char) =>
          `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`,
        );
        return decodeURIComponent(bytes.join(''));
      }

      const globalBuffer = typeof globalThis !== 'undefined' ? (globalThis as any).Buffer : undefined;
      if (globalBuffer && typeof globalBuffer.from === 'function') {
        return globalBuffer.from(padded, 'base64').toString('utf-8');
      }
    } catch {
      return null;
    }

    return null;
  };

  try {
    const decoded = decodeBase64();
    if (!decoded) {
      return null;
    }

    const parsed = JSON.parse(decoded);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const extractClaimString = (value: unknown): string | null => {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
};

export const saveSession = async ({
  accessToken,
  refreshToken,
  sessionId,
  userId,
  username,
  issuedAt,
}: {
  accessToken?: NullableString;
  refreshToken?: NullableString;
  sessionId?: NullableString;
  userId?: NullableString | number;
  username?: NullableString;
  issuedAt?: NullableString;
}) => {
  const claims = decodeJwtPayload(accessToken ?? null);

  const derivedUserId =
    extractClaimString(userId) ??
    extractClaimString(claims?.['userId']) ??
    extractClaimString(claims?.['sub']);

  const derivedUsername =
    extractClaimString(username) ??
    extractClaimString(claims?.['username']) ??
    extractClaimString(claims?.['phoneNumber']) ??
    extractClaimString(claims?.['phone']);
  await Promise.all([
    setItem(ACCESS_TOKEN_KEY, accessToken ?? null),
    setItem(REFRESH_TOKEN_KEY, refreshToken ?? null),
    setItem(SESSION_ID_KEY, sessionId ?? null),
    setItem(USER_ID_KEY, derivedUserId ?? null),
    setItem(USERNAME_KEY, derivedUsername ?? null),
    setItem(ISSUED_AT_KEY, issuedAt ?? null),
  ]);
};

export const updateSessionTokens = async ({
  accessToken,
  refreshToken,
  sessionId,
  issuedAt,
}: {
  accessToken?: NullableString;
  refreshToken?: NullableString;
  sessionId?: NullableString;
  issuedAt?: NullableString;
}) => {
    const claims = decodeJwtPayload(accessToken ?? null);

  const claimUserId =
    extractClaimString(claims?.['userId']) ?? extractClaimString(claims?.['sub']);
  const claimUsername =
    extractClaimString(claims?.['username']) ??
    extractClaimString(claims?.['phoneNumber']) ??
    extractClaimString(claims?.['phone']);

  await Promise.all([
    setItem(ACCESS_TOKEN_KEY, accessToken ?? undefined),
    setItem(REFRESH_TOKEN_KEY, refreshToken ?? undefined),
    setItem(SESSION_ID_KEY, sessionId ?? undefined),
    setItem(USER_ID_KEY, claimUserId ?? undefined),
    setItem(USERNAME_KEY, claimUsername ?? undefined),
    setItem(ISSUED_AT_KEY, issuedAt ?? undefined),
  ]);
};

export const getStoredSession = async (): Promise<StoredSession> => ({
  accessToken: await getItem(ACCESS_TOKEN_KEY),
  refreshToken: await getItem(REFRESH_TOKEN_KEY),
  sessionId: await getItem(SESSION_ID_KEY),
  userId: await getItem(USER_ID_KEY),
  username: await getItem(USERNAME_KEY),
  issuedAt: await getItem(ISSUED_AT_KEY),
});

export const getAccessToken = async () => getItem(ACCESS_TOKEN_KEY);

export const getRefreshToken = async () => getItem(REFRESH_TOKEN_KEY);

export const getStoredUserId = async () => getItem(USER_ID_KEY);

export const getStoredUsername = async () => getItem(USERNAME_KEY);

export const clearSession = async () => {
  await Promise.all([
    storage.removeItem(ACCESS_TOKEN_KEY),
    storage.removeItem(REFRESH_TOKEN_KEY),
    storage.removeItem(SESSION_ID_KEY),
    storage.removeItem(USER_ID_KEY),
    storage.removeItem(USERNAME_KEY),
    storage.removeItem(ISSUED_AT_KEY),
  ]);
};