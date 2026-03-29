import AsyncStorage from '@react-native-async-storage/async-storage';

import { getStoredSession } from './authStorage';
import {
    deleteConversationByIdFromDb,
    remapConversationIdInMessages,
    upsertConversationInDb,
} from './database';
import { createDirectRoom } from './roomsService';

const STORAGE_KEY = 'moc.chatRoomMutationQueue.v1';

type PendingCreateDirectRoomMutation = {
  id: string;
  type: 'create-direct-room';
  createdAt: string;
  localRoomId: number;
  localRoomKey: string;
  participantId: number;
  title: string;
  avatar?: string | null;
  peerPhone?: string | null;
};

const parseJsonSafely = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const readQueue = async (): Promise<PendingCreateDirectRoomMutation[]> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return parseJsonSafely(raw, []);
};

const writeQueue = async (queue: PendingCreateDirectRoomMutation[]) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

export const enqueuePendingRoomCreate = async (entry: {
  localRoomId: number;
  localRoomKey: string;
  participantId: number;
  title: string;
  avatar?: string | null;
  peerPhone?: string | null;
}) => {
  const queue = await readQueue();

  const alreadyQueued = queue.some(
    (item) => item.type === 'create-direct-room' && item.participantId === entry.participantId,
  );

  if (alreadyQueued) {
    return;
  }

  queue.push({
    id: `room-create-${Date.now()}-${entry.participantId}`,
    type: 'create-direct-room',
    createdAt: new Date().toISOString(),
    ...entry,
  });

  await writeQueue(queue);
};

export const flushPendingRoomCreates = async () => {
  const session = await getStoredSession();
  if (!session?.userId) {
    return { processed: 0, remaining: 0 };
  }

  const queue = await readQueue();
  if (!queue.length) {
    return { processed: 0, remaining: 0 };
  }

  const remaining: PendingCreateDirectRoomMutation[] = [];
  let processed = 0;

  for (const item of queue) {
    try {
      const serverRoom = await createDirectRoom(item.participantId);

      await upsertConversationInDb({
        id: serverRoom.id,
        roomKey: serverRoom.roomId,
        title: item.title,
        avatar: item.avatar ?? null,
        peerId: item.participantId,
        peerPhone: item.peerPhone ?? null,
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
        syncState: 'SYNCED',
        pendingCreate: false,
        serverRoomId: serverRoom.id,
      });

      await remapConversationIdInMessages(item.localRoomId, serverRoom.id);
      await deleteConversationByIdFromDb(item.localRoomId);
      processed += 1;
    } catch (error: any) {
      if (!error?.response) {
        remaining.push(item);
        continue;
      }

      console.warn('Permanent room sync failure', item, error);
      processed += 1;
    }
  }

  await writeQueue(remaining);
  return {
    processed,
    remaining: remaining.length,
  };
};