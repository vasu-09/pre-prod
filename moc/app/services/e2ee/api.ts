import apiClient from '../apiClient';

export type DeviceBundleResponse = {
  deviceId: string;
  identityKeyPub: string;
  signedPrekeyPub: string;
  signedPrekeySig?: string | null;
  oneTimePrekeyPub?: string | null;
};

export type OneTimePrekeyPayload = {
  prekeyId?: number | null;
  prekeyPub: string;
};

export type RegisterPayload = {
  deviceId: string;
  name?: string | null;
  platform?: string | null;
  identityKeyPub: string;
  signedPrekeyPub: string;
  signedPrekeySig?: string | null;
  oneTimePrekeys?: OneTimePrekeyPayload[];
};

export const registerDevice = async (payload: RegisterPayload): Promise<void> => {
  await apiClient.post('/api/e2ee/devices/register', payload);
};

export const uploadPrekeys = async (deviceId: string, prekeys: OneTimePrekeyPayload[]): Promise<void> => {
  if (!prekeys.length) {
    return;
  }
  await apiClient.post(`/api/e2ee/devices/${deviceId}/prekeys`, prekeys);
};

export const listDeviceBundles = async (targetUserId: number): Promise<DeviceBundleResponse[]> => {
  const { data } = await apiClient.get<DeviceBundleResponse[]>(`/api/e2ee/users/${targetUserId}/devices`);
  if (!Array.isArray(data)) {
    return [];
  }
  return data;
};

export const claimPrekey = async (targetUserId: number, deviceId: string): Promise<DeviceBundleResponse> => {
  const { data } = await apiClient.post<DeviceBundleResponse>(
    '/api/e2ee/claim-prekey',
    null,
    {
      params: {
        userId: targetUserId,
        deviceId,
      },
    },
  );
  return data;
};

export const getPrekeyStock = async (deviceId: string): Promise<number> => {
  const { data } = await apiClient.get(`/api/e2ee/devices/${deviceId}/stock`);
  const value = Number(data);
  return Number.isFinite(value) ? value : 0;
};