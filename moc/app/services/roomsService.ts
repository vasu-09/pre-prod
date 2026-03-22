import apiClient from './apiClient';

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

export const markRoomRead = async (
  roomId: number,
  messageId: string,
): Promise<void> => {
  await apiClient.put(`/api/rooms/${roomId}/read`, undefined, {
    params: { messageId },
  });
};