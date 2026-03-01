import apiClient from './apiClient';
import { getStoredSession } from './authStorage';
import { upsertUserProfileInDb } from './database';

type AvatarIntentResponse = {
  key?: string;
  putUrl?: string;
  uploadUrl?: string;
  signedUrl?: string;
};

const inferContentType = (uri: string, fallback?: string) => {
  if (fallback && fallback.startsWith('image/')) {
    return fallback;
  }

  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

const getUploadPayload = async (uri: string, contentType: string) => {
  const localResponse = await fetch(uri);
  const blob = await localResponse.blob();
  return {
    blob,
    size: blob.size,
    contentType: blob.type || contentType,
  };
};

const uploadToSignedUrl = async (putUrl: string, blob: Blob, contentType: string) => {
  console.log('[avatar] PUT signed URL host/path', putUrl);

  const putResponse = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: blob,
  });

  if (!putResponse.ok) {
    let errorText = '';

    try {
      errorText = await putResponse.text();
    } catch {
      // Ignore read failures so we can still throw a useful status-based error.
    }

    console.error('[avatar] Signed URL upload failed', {
      status: putResponse.status,
      statusText: putResponse.statusText,
      responseBody: errorText,
      contentType,
      putUrl,
    });

    throw new Error(`Avatar upload failed (${putResponse.status}) ${errorText || ''}`);
  }
};

export const uploadAvatar = async (uri: string, mimeType?: string | null): Promise<string> => {
  const fallbackContentType = inferContentType(uri, mimeType ?? undefined);
  const uploadPayload = await getUploadPayload(uri, fallbackContentType);

  const intentResponse = await apiClient.post<AvatarIntentResponse>('/user/me/avatar/intent', {
    contentType: uploadPayload.contentType,
    size: uploadPayload.size,
    sha256: null,
  });

  console.log('[avatar] intent response', intentResponse?.data);

  const key = intentResponse?.data?.key;
  const putUrl =
    intentResponse?.data?.putUrl ??
    intentResponse?.data?.uploadUrl ??
    intentResponse?.data?.signedUrl;

  if (!key || !putUrl) {
    throw new Error('Avatar intent response missing upload details');
  }

  await uploadToSignedUrl(putUrl, uploadPayload.blob, uploadPayload.contentType);

  await apiClient.post('/user/me/avatar/commit', {
    key,
    size: uploadPayload.size,
    sha256: null,
  });

  const session = await getStoredSession();
  const userId = session?.userId ? Number(session.userId) : null;

  if (!userId) {
    throw new Error('Missing user ID while refreshing avatar');
  }

  const { data } = await apiClient.get(`/user/${userId}`);
  const avatarUrl = typeof data?.avatarUrl === 'string' && data.avatarUrl.trim() ? data.avatarUrl.trim() : uri;

  await upsertUserProfileInDb({
    userId,
    avatarUrl,
    displayName: typeof data?.displayName === 'string' ? data.displayName : null,
    email: typeof data?.email === 'string' ? data.email : null,
    phoneNumber: session?.username ?? null,
    updatedAt: new Date().toISOString(),
  });

  return avatarUrl;
};

export default {
  uploadAvatar,
};