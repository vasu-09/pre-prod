import { useSegments } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { inboxQueue, roomTopic, sendInboxAck as sendInboxAckDestination } from '../constants/stompEndpoints';
import { getAccessToken, getStoredUserId } from '../services/authStorage';
import {
  getRecentConversationsFromDb,
  setConversationUnreadInDb,
  upsertConversationInDb,
} from '../services/database';
import { fetchPendingMessages } from '../services/messagesService';
import { ChatMessageDto } from '../services/roomsService';
import stompClient from '../services/stompClient';

export type RoomLastMessage = {
  messageId: string;
  text?: string | null;
  at: string;
  senderId?: number | null;
};

export type RoomSummary = {
  id: number;
  roomKey: string;
  title: string;
  avatar?: string | null;
  peerId?: number | null;
  peerPhone?: string | null;
  lastMessage?: RoomLastMessage | null;
  unreadCount: number;
};

type ChatContextValue = {
  rooms: RoomSummary[];
  upsertRoom: (room: Partial<RoomSummary> & { id: number; roomKey: string }) => void;
  updateRoomActivity: (roomKey: string, message: RoomLastMessage) => void;
  incrementUnread: (roomKey: string) => void;
  resetUnread: (roomKey: string) => void;
};

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

const sortRooms = (rooms: RoomSummary[]) => {
  return [...rooms].sort((a, b) => {
    const aTime = a.lastMessage?.at ?? '1970-01-01T00:00:00Z';
    const bTime = b.lastMessage?.at ?? '1970-01-01T00:00:00Z';
    return bTime.localeCompare(aTime);
  });
};

const makeTempRoomIdFromKey = (roomKey: string) => {
  let hash = 0;
  for (let i = 0; i < roomKey.length; i += 1) {
    hash = (hash * 31 + roomKey.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || Date.now();
};

const stableDmRoomKey = (userA: number | null, userB: number | null) => {
  if (userA == null || userB == null) return null;
  const low = Math.min(userA, userB);
  const high = Math.max(userA, userB);
  return `dm:${low}:${high}`;
};

const coerceNumber = (value: any) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const deriveRoomKeyFromPayload = (payload: any, currentUserId: number | null) => {
  const roomKey =
    payload?.roomKey != null
      ? String(payload.roomKey)
      : payload?.conversationKey != null
        ? String(payload.conversationKey)
        : payload?.key != null
          ? String(payload.key)
          : null;

  if (roomKey) return roomKey;

  const peerCandidate =
    typeof payload?.peerId === 'number'
      ? payload.peerId
      : typeof payload?.senderId === 'number'
        ? payload.senderId
        : coerceNumber(payload?.fromUserId);

  const fallback = stableDmRoomKey(currentUserId, coerceNumber(peerCandidate));
  if (fallback) return fallback;

  if (payload?.msgId || payload?.messageId) {
    return `pending:${payload.msgId ?? payload.messageId}`;
  }
  return null;
};

export const ChatProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const segments = useSegments();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const subscriptionsRef = useRef<Record<string, () => void>>({});
  const [sessionReady, setSessionReady] = useState(false);
  const inboxUnsubRef = useRef<(() => void) | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const roomsRef = useRef<RoomSummary[]>([]);
  const routePath = segments.join('/');
  const shouldConnectRealtime = ![
    'screens/PermissionsScreen',
    'screens/LoginScreen',
    'screens/OtpScreen',
    'screens/CompleteProfileScreen',
  ].includes(routePath);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const ensureSession = async () => {
      try {
        const [token, storedUserId] = await Promise.all([getAccessToken(), getStoredUserId()]);

        if (cancelled) return;

        if (storedUserId != null) {
          const parsed = Number(storedUserId);
          setCurrentUserId(Number.isNaN(parsed) ? null : parsed);
        }else {
          setCurrentUserId(null);
        }

        if (token) {
          setAccessToken(token);
          setSessionReady(true);
          return;
        } else {
          setAccessToken(null);
          setSessionReady(false);
        }
      } catch {
        // ignore and retry
      }

      if (!cancelled) {
        retryTimer = setTimeout(ensureSession, 1500);
      }
    };

    ensureSession();

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, []);


  useEffect(() => {
    getStoredUserId()
      .then(value => {
        if (value != null) {
          const parsed = Number(value);
          setCurrentUserId(Number.isNaN(parsed) ? null : parsed);
        }
      })
      .catch(() => setCurrentUserId(null));
  }, []);

  useEffect(() => {
    let cancelled = false;

    getRecentConversationsFromDb()
      .then(results => {
        if (cancelled) {
          return;
        }
        const restored = results.map(room => ({
          id: room.id,
          roomKey: room.roomKey,
          title: room.title ?? room.roomKey,
          avatar: room.avatar ?? null,
          peerId: room.peerId ?? null,
          peerPhone: room.peerPhone ?? null,
          lastMessage: room.lastMessage
            ? {
                messageId: room.lastMessage.id,
                text: room.lastMessage.plaintext ?? room.lastMessage.ciphertext ?? undefined,
                at: room.lastMessage.createdAt ?? new Date().toISOString(),
                senderId: room.lastMessage.senderId ?? undefined,
              }
            : null,
          unreadCount: room.unreadCount ?? 0,
        }));
        setRooms(sortRooms(restored));
      })
      .catch(err => console.warn('Failed to hydrate chat registry from SQLite', err));

    return () => {
      cancelled = true;
    };
  }, []);

  const persistConversation = useCallback((summary: RoomSummary) => {
    upsertConversationInDb({
      id: summary.id,
      roomKey: summary.roomKey,
      title: summary.title,
      avatar: summary.avatar,
      peerId: summary.peerId,
      peerPhone: summary.peerPhone,
      unreadCount: summary.unreadCount,
      updatedAt: summary.lastMessage?.at,
    }).catch(err => console.warn('Failed to persist conversation', summary.id, err));
  }, []);

  const upsertRoom = useCallback(
  (room: Partial<RoomSummary> & { id: number; roomKey: string }) => {
      setRooms(prev => {
        const existingIndex = prev.findIndex(r => r.roomKey === room.roomKey);
        let nextSummary: RoomSummary;

        if (existingIndex >= 0) {
          const next = [...prev];
          const existing = next[existingIndex];

          nextSummary = {
            ...existing,
            ...room,
            peerPhone: room.peerPhone ?? existing.peerPhone ?? null,
            unreadCount: room.unreadCount ?? existing.unreadCount,
          };

          next[existingIndex] = nextSummary;
          persistConversation(nextSummary);
          return sortRooms(next);
        }

        nextSummary = {
          id: room.id,
          roomKey: room.roomKey,
          title: room.title ?? room.roomKey,
          avatar: room.avatar ?? null,
          peerId: room.peerId ?? null,
          peerPhone: room.peerPhone ?? null,
          lastMessage: room.lastMessage ?? null,
          unreadCount: room.unreadCount ?? 0,
        };

        persistConversation(nextSummary);
        return sortRooms([...prev, nextSummary]);
      });
    },
    [persistConversation],
  );

  

const updateRoomActivity = useCallback(
  (roomKey: string, message: RoomLastMessage) => {
    setRooms(prev => {
      const idx = prev.findIndex(r => r.roomKey === roomKey);
      if (idx === -1) return prev;

      const next = [...prev];
      next[idx] = {
        ...next[idx],
        lastMessage: message,
      };
      persistConversation(next[idx]);
      return sortRooms(next);
    });
  },
  [persistConversation],
);

const incrementUnread = useCallback(
  (roomKey: string) => {
    setRooms(prev => {
      const idx = prev.findIndex(r => r.roomKey === roomKey);
      if (idx === -1) return prev;

      const next = [...prev];
      next[idx] = {
        ...next[idx],
        unreadCount: next[idx].unreadCount + 1,
      };
      setConversationUnreadInDb(next[idx].roomKey, next[idx].unreadCount).catch(err =>
        console.warn('Failed to increment unread counter in DB', err),
      );
      persistConversation(next[idx]);
      return next;
    });
  },
  [persistConversation],
);

const resetUnread = useCallback(
  (roomKey: string) => {
    setRooms(prev => {
      const idx = prev.findIndex(r => r.roomKey === roomKey);
      if (idx === -1) return prev;

      const next = [...prev];
      next[idx] = {
        ...next[idx],
        unreadCount: 0,
      };
      setConversationUnreadInDb(next[idx].roomKey, 0).catch(err =>
        console.warn('Failed to reset unread counter in DB', err),
      );
      persistConversation(next[idx]);
      return next;
    });
  },
  [persistConversation],
);

const sendInboxAck = useCallback((msgId: string, roomKey?: string | null) => {
    if (!msgId) return;
    stompClient
      .publish(sendInboxAckDestination, { msgId, roomKey, status: 'DELIVERED' })
      .catch(err => console.warn('[WS][INBOX] ack failed', err));
  }, []);

  const handleInboxPayload = useCallback(
    (payload: any) => {
      if (!payload) return;

      const roomKey = deriveRoomKeyFromPayload(payload, currentUserId);
      if (!roomKey) {
        console.warn('[WS][INBOX] missing roomKey', payload);
        return;
      }

      const roomIdRaw = payload.roomDbId ?? payload.roomId ?? payload.conversationId ?? payload.id;
      const parsedRoomId = coerceNumber(roomIdRaw);
      const roomId = parsedRoomId ?? makeTempRoomIdFromKey(String(roomKey));

      const existing = roomsRef.current.find(r => r.roomKey === roomKey) ?? null;
      const peerId =
        typeof payload.peerId === 'number'
          ? payload.peerId
          : existing?.peerId ?? (roomKey.startsWith('dm:') ? coerceNumber(payload.senderId ?? payload.fromUserId) : null);

      const messageId = payload.msgId ?? payload.messageId ?? null;
      const senderId =
        typeof payload.senderId === 'number'
          ? payload.senderId
          : coerceNumber(payload.fromUserId ?? payload.senderId);
      const createdAt = payload.serverTs ?? payload.createdAt ?? new Date().toISOString();

      const lastMessage: RoomLastMessage | null = messageId
        ? {
            messageId: String(messageId),
            text: payload.body ?? payload.plaintext ?? payload.ciphertext ?? null,
            at: createdAt,
            senderId: senderId ?? undefined,
          }
        : existing?.lastMessage ?? null;

      upsertRoom({
        id: roomId,
        roomKey,
        title: payload.roomName ?? payload.title ?? existing?.title ?? roomKey,
        avatar: payload.roomImage ?? payload.avatar ?? existing?.avatar ?? null,
        peerId: peerId ?? null,
        lastMessage,
        unreadCount: existing?.unreadCount ?? 0,
      });

      if (senderId != null && senderId !== currentUserId) {
        incrementUnread(roomKey);
      }

      if (messageId) {
        sendInboxAck(String(messageId), roomKey);
      }
    },
    [currentUserId, incrementUnread, sendInboxAck, upsertRoom],
  );

  const syncPendingMessages = useCallback(() => {
    if (!sessionReady || !accessToken || !shouldConnectRealtime) return;
    fetchPendingMessages()
      .then(list => {
        list.forEach(handleInboxPayload);
      })
      .catch(err => console.warn('[WS][INBOX] pending sync failed', err));
  }, [accessToken, handleInboxPayload, sessionReady, shouldConnectRealtime]);


  const value = useMemo(
    () => ({ rooms, upsertRoom, updateRoomActivity, incrementUnread, resetUnread }),
    [rooms, upsertRoom, updateRoomActivity, incrementUnread, resetUnread],
  );

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    if (!sessionReady || !accessToken || !shouldConnectRealtime) return;

    stompClient.ensureConnected().catch(err => console.warn('Global STOMP connect failed', err));
  }, [sessionReady, accessToken, shouldConnectRealtime]);

  useEffect(() => {
    if (!sessionReady || !accessToken || !shouldConnectRealtime) return;
    let cancelled = false;

    syncPendingMessages();

    const removeListener = stompClient.onConnect(() => {
      if (!cancelled) {
        syncPendingMessages();
      }
    });

    return () => {
      cancelled = true;
      if (removeListener) {
        removeListener();
      }
    };
  }, [accessToken, sessionReady, shouldConnectRealtime, syncPendingMessages]);


  useEffect(() => {
    if (!sessionReady || !accessToken || !currentUserId || !shouldConnectRealtime) {
      return;
    }

    // Already subscribed
    if (inboxUnsubRef.current) {
      return;
    }

    let cancelled = false;

    stompClient
      .ensureConnected()
      .then(() => {
        if (cancelled || inboxUnsubRef.current) return;

        inboxUnsubRef.current = stompClient.subscribe(inboxQueue, frame => {
          let payload: any = null;
          try {
            payload = frame.body ? JSON.parse(frame.body) : null;
          } catch (err) {
            console.warn('[WS][INBOX] Failed to parse inbox frame', err);
            return;
          }
          if (!payload) return;

          handleInboxPayload(payload);
        });
      })
      .catch(err => console.warn('[WS][INBOX] listener failed to connect', err));

    return () => {
      cancelled = true;
      if (inboxUnsubRef.current) {
        try {
          inboxUnsubRef.current();
        } catch {
          // ignore
        }
        inboxUnsubRef.current = null;
      }
    };
  }, [sessionReady, accessToken, currentUserId, handleInboxPayload, shouldConnectRealtime]);


 useEffect(() => {
    if (!sessionReady || !accessToken || !shouldConnectRealtime) {
      return;
    }

    const existingSubs = subscriptionsRef.current;
    const activeKeys = new Set(rooms.map(r => r.roomKey));

    // cleanup stale
    Object.entries(existingSubs).forEach(([key, unsubscribe]) => {
      if (!activeKeys.has(key)) {
        try {
          unsubscribe();
        } catch {
          // ignore
        }
        delete existingSubs[key];
      }
    });

    let cancelled = false;

    stompClient
      .ensureConnected()
      .then(() => {
        rooms.forEach(room => {
          const key = room.roomKey;
          if (!key || existingSubs[key]) return;

          const unsubscribe = stompClient.subscribe(roomTopic(key), frame => {
            if (cancelled) return;

            let payload: ChatMessageDto | null = null;
            try {
              payload = frame.body ? JSON.parse(frame.body) : null;
            } catch (err) {
              console.warn('Failed to parse inbound message frame', err);
              return;
            }
            if (!payload) return;

            const lastMessage: RoomLastMessage = {
              messageId: payload.messageId,
              text: payload.body ?? payload.ciphertext ?? null,
              at: payload.serverTs ?? new Date().toISOString(),
              senderId: payload.senderId ?? null,
            };

            updateRoomActivity(key, lastMessage);

            if (payload.roomId != null && payload.roomId !== room.id) {
              upsertRoom({ ...room, id: payload.roomId, roomKey: key });
            }

            if (currentUserId == null || payload.senderId !== currentUserId) {
              incrementUnread(key);
            }
          });

          existingSubs[key] = unsubscribe;
        });
      })
      .catch(err => console.warn('Global chat listener failed to connect', err));

    return () => {
      cancelled = true;
    };
  }, [rooms, sessionReady, accessToken, currentUserId, incrementUnread, shouldConnectRealtime, updateRoomActivity, upsertRoom]);


  useEffect(
    () => () => {
      const subs = subscriptionsRef.current;
      Object.values(subs).forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch {
      
          // ignore
        }
      });
      subscriptionsRef.current = {};
      if (inboxUnsubRef.current) {
        try {
          inboxUnsubRef.current();
        } catch {
          // ignore
        }
        inboxUnsubRef.current = null;
      }
    },
    [],
  );
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChatRegistry = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChatRegistry must be used within a ChatProvider');
  }
  return ctx;
};