import { Platform } from 'react-native';

import apiClient from './apiClient';
import { getStoredSession } from './authStorage';
import { getDeviceMetadata, setStoredFcmToken } from './deviceMetadata';

let notificationsModulePromise;

const loadNotificationsModule = async () => {
  if (notificationsModulePromise) {
    return notificationsModulePromise;
  }

  // eslint-disable-next-line import/no-unresolved
  notificationsModulePromise = import('expo-notifications')
    .then(module => module)
    .catch(error => {
      console.warn('[pushRegistration] expo-notifications is unavailable; skipping push token registration.', error);
      return null;
    });

  return notificationsModulePromise;
};

const extractToken = (rawToken) => {
  if (!rawToken) return '';
  if (typeof rawToken === 'string') return rawToken;
  if (typeof rawToken?.data === 'string') return rawToken.data;
  return '';
};

export const ensurePushToken = async ({ requestPermission = true } = {}) => {
  const metadata = await getDeviceMetadata();
  const storedToken = metadata.fcmToken ?? '';

  if (Platform.OS === 'web') {
    return storedToken;
  }

  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return storedToken;
  }

  try {
    const existingPermissions = await Notifications.getPermissionsAsync();
    let finalStatus = existingPermissions?.status;

    if (finalStatus !== 'granted' && requestPermission) {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      finalStatus = requestedPermissions?.status;
    }

    if (finalStatus !== 'granted') {
      return storedToken;
    }

    const resolvedToken = extractToken(await Notifications.getDevicePushTokenAsync());
    if (!resolvedToken) {
      return storedToken;
    }

    if (resolvedToken !== storedToken) {
      await setStoredFcmToken(resolvedToken);
    }

    return resolvedToken;
  } catch (error) {
    console.warn('[pushRegistration] Failed to resolve push token.', error);
    return storedToken;
  }
};

export const syncPushTokenWithBackend = async () => {
  const [{ accessToken, sessionId }, metadata] = await Promise.all([getStoredSession(), getDeviceMetadata()]);

  if (!accessToken || !sessionId) {
    return false;
  }
  const token = await ensurePushToken({ requestPermission: true });

  if (!token) {
    return false;
  }

  await apiClient.post('/user/me/devices', {
    sessionId,
    fcmToken: token,
    deviceModel: metadata.deviceModel,
    appVersion: metadata.appVersion,
    platform: metadata.platform,
  });

  return true;
};