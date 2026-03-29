import apiClient from './apiClient';
import { upsertConversationInDb } from './database';

export interface ChatRoomResponse {
  id: number;
  roomId: string;
  name?: string | null;
  imageUrl?: string | null;
}

export interface ChatMessageDto {
  roomId: number;
  messageId: string;
  senderId: number;
  type: string;
  serverTs: string;
  body?: string;
  e2ee?: boolean;
  e2eeVer?: number;
  algo?: string;
  aad?: string;
  iv?: string;
  ciphertext?: string;
  keyRef?: string;
  senderDeviceId?: string | null;
  deletedBySender?: boolean;
  deletedByReceiver?: boolean;
  deletedForEveryone?: boolean;
  systemMessage?: boolean;
}

export const createDirectRoom = async (
  participantId: number,
): Promise<ChatRoomResponse> => {
  const normalizedId = Number(participantId);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new Error('A valid participant id is required to start a chat');
  }
  const { data } = await apiClient.post<ChatRoomResponse>('/api/rooms/direct', {
    participantId: normalizedId,
  });

  return data;
};

const makeLocalRoomId = () => -Date.now();

export const makeStableDmRoomKey = (currentUserId: number, peerId: number) => {
  const low = Math.min(currentUserId, peerId);
  const high = Math.max(currentUserId, peerId);
  return `local-dm:${low}:${high}`;
};

export const createLocalDirectRoom = async ({
  currentUserId,
  participantId,
  title,
  avatar,
  peerPhone,
}: {
  currentUserId: number;
  participantId: number;
  title: string;
  avatar?: string | null;
  peerPhone?: string | null;
}): Promise<ChatRoomResponse & { pendingCreate: boolean }> => {
  const localId = makeLocalRoomId();
  const roomKey = makeStableDmRoomKey(currentUserId, participantId);
  const now = new Date().toISOString();

  await upsertConversationInDb({
    id: localId,
    roomKey,
    title,
    avatar: avatar ?? null,
    peerId: participantId,
    peerPhone: peerPhone ?? null,
    unreadCount: 0,
    createdAt: now,
    updatedAt: now,
    syncState: 'PENDING_CREATE',
    pendingCreate: true,
    serverRoomId: null,
  });

  return {
    id: localId,
    roomId: roomKey,
    name: title,
    imageUrl: avatar ?? null,
    pendingCreate: true,
  };
};

export const markRoomRead = async (
  roomId: number,
  messageId: string,
): Promise<void> => {
  await apiClient.put(`/api/rooms/${roomId}/read`, undefined, {
    params: { messageId },
  });
};