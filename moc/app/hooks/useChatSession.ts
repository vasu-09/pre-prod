import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ackQueue,
  dmReceiptQueue,
  dmTypingQueue,
  roomReadTopic,
  roomTopic,
  roomTypingTopic,
  sendDirectRead,
  sendDirectTyping,
  sendInboxAck,
  sendRoomMessage,
  sendRoomRead,
  sendRoomTyping,
} from '../constants/stompEndpoints';
import { useChatRegistry } from '../context/ChatContext';
import { getStoredUserId } from '../services/authStorage';
import {
  deleteMessagesFromDb,
  getMessagesForConversationFromDb,
  saveMessagesToDb,
  updateMessageFlagsInDb,
  type MessageRecordInput,
} from '../services/database';
import { E2EEClient, E2EEEnvelope, getE2EEClient } from '../services/e2ee';
import { bytesToBase64 } from '../services/e2ee/encoding';
import {
  decryptMessage,
  encryptMessage,
  ensureSharedRoomKey,
  type EncryptedPayload,
} from '../services/messageCrypto';
import {
  ChatMessageDto,
  fetchRoomMessages,
  markRoomRead,
} from '../services/roomsService';
import stompClient, { StompFrame } from '../services/stompClient';
import { mergeIncomingMessage, type InternalMessage } from './messageMerging';
export type { InternalMessage } from './messageMerging';

export type DisplayMessage = {
  id: string;
  messageId: string;
  roomId: number | string | null;
  senderId: number | null;
  sender: 'me' | 'other';
  text?: string | null;
  time: string;
  serverTs?: string | null;
  pending?: boolean;
  failed?: boolean;
  raw: InternalMessage;
  readByPeer?: boolean;
};

type TypingUser = {
  userId: number;
  expiresAt: number;
};

type ReplyMetadata = {
  messageId?: string | null;
  senderId?: number | null;
  previewText?: string | null;
  isMine?: boolean;
};

const MESSAGE_TYPE_TEXT = 'TEXT';
const SHOULD_LOG_DECRYPT = __DEV__ && process.env.EXPO_PUBLIC_DEBUG_DECRYPT !== '0';
const SHOULD_LOG_E2EE = __DEV__ && process.env.EXPO_PUBLIC_DEBUG_E2EE !== '0';
const DECRYPTION_PENDING_MESSAGE = 'Waiting for this message. This may take a while.';

const formatTime = (iso?: string | null) => {
  if (!iso) {
    return '';
  }
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const normalizeBinary = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Uint8Array) {
    return bytesToBase64(value);
  }
  if (Array.isArray(value) && value.every(n => typeof n === 'number')) {
    return bytesToBase64(Uint8Array.from(value));
  }
  return null;
};

const parseReplyMetadataFromBody = (body?: string | null): {
  replyToMessageId: string | null;
  replyToSenderId: number | null;
  replyToPreview: string | null;
} | null => {
  if (!body || typeof body !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(body);
    if (parsed?.type !== 'reply' || !parsed?.replyTo) {
      return null;
    }
    const replyTo = parsed.replyTo;
    const messageId = replyTo?.messageId != null ? String(replyTo.messageId) : null;
    const senderIdValue = Number(replyTo?.senderId);
    const senderId = Number.isFinite(senderIdValue) ? senderIdValue : null;
    const previewText = typeof replyTo?.previewText === 'string' ? replyTo.previewText : null;
    return {
      replyToMessageId: messageId,
      replyToSenderId: senderId,
      replyToPreview: previewText,
    };
  } catch {
    return null;
  }
};

const toInternalMessage = (dto: ChatMessageDto): InternalMessage => ({
  ...(parseReplyMetadataFromBody(dto.body) ?? {}),
  messageId: dto.messageId,
  roomId: dto.roomId,
  senderId: dto.senderId,
  type: dto.type,
  body: dto.body,
  serverTs: dto.serverTs,
  pending: false,
  error: false,
  readByPeer: false,
  e2ee: dto.e2ee,
  deletedBySender: dto.deletedBySender,
  deletedByReceiver: dto.deletedByReceiver,
  deletedForEveryone: dto.deletedForEveryone,
  systemMessage: dto.systemMessage,
});

const generateMessageId = () => {
  if (typeof globalThis !== 'undefined' && (globalThis as any)?.crypto?.randomUUID) {
    return (globalThis as any).crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
};

const toStoredMessage = (record: MessageRecordInput): InternalMessage => ({
  messageId: record.id,
  roomId: record.conversationId,
  senderId: record.senderId ?? null,
  type: MESSAGE_TYPE_TEXT,
  body: record.plaintext ?? null,
  replyToMessageId: record.replyToMessageId ?? null,
  replyToSenderId: record.replyToSenderId ?? null,
  replyToPreview: record.replyToPreview ?? null,
  serverTs: record.createdAt ?? null,
  ciphertext: record.ciphertext ?? null,
  aad: record.aad ?? null,
  iv: record.iv ?? null,
  keyRef: record.keyRef ?? null,
  senderDeviceId: record.senderDeviceId ?? null,
  pending: record.pending,
  error: record.error,
  readByPeer: record.readByPeer,
  e2ee: record.e2ee,
  deletedBySender: record.deletedBySender,
  deletedByReceiver: record.deletedByReceiver,
  deletedForEveryone: record.deletedForEveryone,
  systemMessage: record.systemMessage,
});

const parseFrameBody = (frame: StompFrame) => {
  try {
    return frame.body ? JSON.parse(frame.body) : null;
  } catch (err) {
    console.warn('Failed to parse STOMP frame body', err);
    return null;
  }
};

export const useChatSession = ({
  roomId,
  roomKey,
  peerId,
  title,
  disableSubscriptions = false,
}: {
  roomId: number | null;
  roomKey: string | null;
  peerId?: number | null;
  title?: string | null;
  disableSubscriptions?: boolean;
}) => {
  const { upsertRoom, updateRoomActivity, incrementUnread, resetUnread } = useChatRegistry();
  const [rawMessages, setRawMessages] = useState<InternalMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typing, setTyping] = useState<TypingUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [e2eeClient, setE2eeClient] = useState<E2EEClient | null>(null);
  const [e2eeReady, setE2eeReady] = useState(false);
  const [sharedRoomKey, setSharedRoomKey] = useState<string | null>(null);
  const latestMessageIdRef = useRef<string | null>(null);
  const resolvedRoomKey = useMemo(
    () => roomKey ?? (roomId != null ? String(roomId) : null),
    [roomId, roomKey],
  );
  const typingSentRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionsRef = useRef<(() => void)[]>([]);

  const toDbRecord = useCallback(
    (
      message: InternalMessage,
      payload?: Partial<ChatMessageDto> & { ciphertext?: string; aad?: string; iv?: string; keyRef?: string; e2ee?: boolean },
      roomIdOverride?: number | null,
    ) => {
      const parsedReply =
        message.replyToMessageId || message.replyToSenderId != null || message.replyToPreview
          ? {
              replyToMessageId: message.replyToMessageId ?? null,
              replyToSenderId: message.replyToSenderId ?? null,
              replyToPreview: message.replyToPreview ?? null,
            }
          : parseReplyMetadataFromBody(message.body ?? null);

      return {
        id: message.messageId,
        conversationId: roomIdOverride ?? message.roomId ?? null,
        senderId: message.senderId ?? null,
        plaintext: message.body ?? null,
        ciphertext: payload?.ciphertext ?? null,
        aad: payload?.aad ?? null,
        iv: payload?.iv ?? null,
        keyRef: payload?.keyRef ?? null,
        senderDeviceId: payload?.senderDeviceId ?? null,
        e2ee: payload?.e2ee ?? message.e2ee ?? false,
        createdAt: message.serverTs ?? new Date().toISOString(),
        pending: message.pending,
        error: message.error,
        readByPeer: message.readByPeer,
        deletedBySender: message.deletedBySender,
        deletedByReceiver: message.deletedByReceiver,
        deletedForEveryone: message.deletedForEveryone,
        systemMessage: message.systemMessage,
        replyToMessageId: parsedReply?.replyToMessageId ?? null,
        replyToSenderId: parsedReply?.replyToSenderId ?? null,
        replyToPreview: parsedReply?.replyToPreview ?? null,
      };
    },
    [],
  );

  const isDeletedForUser = useCallback(
    (message: InternalMessage) => {
      if (!currentUserId || message.deletedForEveryone) {
        return false;
      }
      const fromCurrentUser = message.senderId === currentUserId;
      if (fromCurrentUser) {
        return Boolean(message.deletedBySender);
      }
      return Boolean(message.deletedByReceiver);
    },
    [currentUserId],
  );

  useEffect(() => {
    getStoredUserId()
      .then(value => {
        if (value != null) {
          const parsed = Number(value);
          setCurrentUserId(Number.isNaN(parsed) ? null : parsed);
        }
      })
      .catch(() => setCurrentUserId(null))
      .finally(() => setUserLoaded(true));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!resolvedRoomKey) {
      setSharedRoomKey(null);
      return undefined;
    }
    ensureSharedRoomKey(resolvedRoomKey)
      .then(key => {
        if (!cancelled) {
          setSharedRoomKey(key);
        }
      })
      .catch(err => {
        console.warn('Failed to derive shared room key', err);
        if (!cancelled) {
          setSharedRoomKey(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedRoomKey]);

  useEffect(() => {
    if (!sharedRoomKey) {
      return;
    }

    let cancelled = false;
    const candidates = rawMessages.filter(
      msg =>
        !msg.keyRef &&
        Boolean(msg.ciphertext) &&
        Boolean(msg.iv) &&
        (!msg.body || msg.body === DECRYPTION_PENDING_MESSAGE) &&
        !msg.decryptionFailed,
    );
    if (!candidates.length) {
      return undefined;
    }

    (async () => {
      const updates: Record<string, { text: string | null; failed: boolean }> = {};
      for (const msg of candidates) {
        try {
          const text = await decryptMessage(
            {
              ciphertext: msg.ciphertext as string,
              iv: msg.iv as string,
              aad: msg.aad ?? undefined,
            },
            sharedRoomKey,
          );
          updates[msg.messageId] = { text, failed: false };
        } catch (err) {
          console.warn('Failed to decrypt cached message', { messageId: msg.messageId }, err);
          updates[msg.messageId] = { text: DECRYPTION_PENDING_MESSAGE, failed: true };
        }
      }

      if (!cancelled && Object.keys(updates).length) {
        setRawMessages(prev =>
          prev.map(msg =>
            updates[msg.messageId]
               ? {
                  ...msg,
                  body: updates[msg.messageId].text,
                  decryptionFailed: updates[msg.messageId].failed,
                  debugBody: updates[msg.messageId].failed ? msg.debugBody ?? null : null,
                }
              : msg,
          ),
        );
      const successful = Object.entries(updates)
          .filter(([, result]) => !result.failed)
          .map(([id, result]) => {
            const original = rawMessages.find(msg => msg.messageId === id);
            if (!original) {
              return null;
            }
            const merged: InternalMessage = {
              ...original,
              body: result.text,
              decryptionFailed: false,
              debugBody: null,
            };
            return toDbRecord(merged, {
              ciphertext: original.ciphertext ?? undefined,
              aad: original.aad ?? undefined,
              iv: original.iv ?? undefined,
              keyRef: original.keyRef ?? undefined,
              e2ee: original.e2ee,
            });
          })
          .filter(Boolean) as ReturnType<typeof toDbRecord>[];

        if (successful.length) {
          saveMessagesToDb(successful).catch(err =>
            console.warn('Failed to persist decrypted cached messages', err),
          );
        }
        }
    })();

    return () => {
      cancelled = true;
    };
  }, [rawMessages, saveMessagesToDb, sharedRoomKey, toDbRecord]);

  useEffect(() => {
    if (!e2eeClient || currentUserId == null) {
      return;
    }

    let cancelled = false;
    const candidates = rawMessages.filter(
      msg =>
        Boolean(msg.keyRef) &&
        Boolean(msg.ciphertext) &&
        Boolean(msg.iv) &&
        Boolean(msg.aad) &&
        (!msg.body || msg.body === DECRYPTION_PENDING_MESSAGE) &&
        !msg.decryptionFailed,
    );

    if (!candidates.length) {
      return undefined;
    }

    (async () => {
      const updates: Record<string, { text: string | null; failed: boolean }> = {};
      for (const msg of candidates) {
        try {
          const envelope: E2EEEnvelope = {
            messageId: msg.messageId,
            aad: msg.aad as string,
            iv: msg.iv as string,
            ciphertext: msg.ciphertext as string,
            keyRef: msg.keyRef as string,
          };
          const fromSelf = currentUserId != null && msg.senderId === currentUserId;
          const text = await e2eeClient.decryptEnvelope(envelope, Boolean(fromSelf), {
            senderId: msg.senderId ?? undefined,
            sessionId: msg.keyRef ?? null,
            senderDeviceId: msg.senderDeviceId ?? null,
          });
          updates[msg.messageId] = { text, failed: false };
        } catch (err) {
          console.warn('Failed to decrypt cached envelope', { messageId: msg.messageId }, err);
          updates[msg.messageId] = { text: DECRYPTION_PENDING_MESSAGE, failed: true };
        }
      }

      if (!cancelled && Object.keys(updates).length) {
        setRawMessages(prev =>
          prev.map(msg =>
            updates[msg.messageId]
              ? {
                  ...msg,
                  body: updates[msg.messageId].text,
                  decryptionFailed: updates[msg.messageId].failed,
                  debugBody: updates[msg.messageId].failed ? msg.debugBody ?? null : null,
                }
              : msg,
          ),
        );
        const successful = Object.entries(updates)
          .filter(([, result]) => !result.failed)
          .map(([id, result]) => {
            const original = rawMessages.find(msg => msg.messageId === id);
            if (!original) {
              return null;
            }
            const merged: InternalMessage = {
              ...original,
              body: result.text,
              decryptionFailed: false,
              debugBody: null,
            };
            return toDbRecord(merged, {
              ciphertext: original.ciphertext ?? undefined,
              aad: original.aad ?? undefined,
              iv: original.iv ?? undefined,
              keyRef: original.keyRef ?? undefined,
              e2ee: original.e2ee,
            });
          })
          .filter(Boolean) as ReturnType<typeof toDbRecord>[];

        if (successful.length) {
          saveMessagesToDb(successful).catch(err =>
            console.warn('Failed to persist decrypted cached envelopes', err),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, e2eeClient, rawMessages, saveMessagesToDb, toDbRecord]);

  useEffect(() => {
    let cancelled = false;
    if (SHOULD_LOG_E2EE) {
      console.debug('[CHAT][E2EE] initializing client');
    }
    getE2EEClient()
      .then(client => {
        if (!cancelled) {
          setE2eeClient(client);
          if (SHOULD_LOG_E2EE) {
            console.debug('[CHAT][E2EE] client ready', {
              deviceId: typeof client.getDeviceId === 'function' ? client.getDeviceId() : undefined,
            });
          }
        }
      })
      .catch(err => {
        console.warn('E2EE initialization failed', err);
        if (SHOULD_LOG_E2EE) {
          console.debug('[CHAT][E2EE] client init failed', {
            reason: err instanceof Error ? err.message : String(err),
          });
        }
        if (!cancelled) {
          setE2eeClient(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setE2eeReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!roomId) {
      setRawMessages([]);
      return;
    }

    let cancelled = false;
    getMessagesForConversationFromDb(roomId, 100)
      .then(stored => {
        if (cancelled) {
          return;
        }
        if (stored.length) {
          const storedMessages = stored.map(toStoredMessage);
          const deletedForUser = storedMessages.filter(isDeletedForUser);
          const deletedIds = deletedForUser.map(message => message.messageId);
          const visibleMessages = storedMessages.filter(
            message => !deletedIds.includes(message.messageId),
          );
          if (deletedIds.length) {
            deleteMessagesFromDb(deletedIds).catch(err =>
              console.warn('Failed to purge locally deleted messages', err),
            );
          }
          setRawMessages(visibleMessages);
          const last = visibleMessages[visibleMessages.length - 1];
          latestMessageIdRef.current = last?.messageId ?? null;
        }
      }).catch(err => console.warn('Failed to load cached messages', err));

    return () => {
      cancelled = true;
    };
  }, [roomId, deleteMessagesFromDb, isDeletedForUser]);

  useEffect(() => {
    if (!roomId || !resolvedRoomKey) {
      return;
    }
    upsertRoom({
      id: roomId,
      roomKey: resolvedRoomKey,
      title: title ?? resolvedRoomKey,
      peerId: peerId ?? null,
    });
  }, [roomId, resolvedRoomKey, title, peerId, upsertRoom]);

  const mergeMessage = useCallback((incoming: InternalMessage) => {
    setRawMessages(prev => {
      const idx = prev.findIndex(
        message => String(message.messageId) === String(incoming.messageId),
      );
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = { ...prev[idx], ...incoming };
        return next;
      }
      return [...prev, incoming];
    });
  }, []);

  const loadHistory = useCallback(async () => {
    if (!roomId) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchRoomMessages(roomId, { limit: 50 });
      const ordered = data.slice().reverse();
      const client = e2eeClient;
      const processed: InternalMessage[] = await Promise.all(
        ordered.map(async dto => {
          const base = toInternalMessage(dto);
          const aad = normalizeBinary(dto.aad);
          const iv = normalizeBinary(dto.iv);
          const ciphertext = normalizeBinary(dto.ciphertext);
          let text = dto.body ?? null;
          let failed = false;
          let debugBody: string | null = null;
          const encryptedPayload: EncryptedPayload | null =
            ciphertext && iv
              ? {
                  ciphertext,
                  iv,
                  aad: aad ?? undefined,
                }
              : null;
          if (dto.e2ee && ciphertext && aad && iv && dto.keyRef) {
            const envelope: E2EEEnvelope = {
              messageId: dto.messageId,
              aad,
              iv,
              ciphertext,
              keyRef: dto.keyRef,
            };
            const fromSelf = currentUserId != null && dto.senderId === currentUserId;
            if (client) {
              try {
                  text = await client.decryptEnvelope(envelope, Boolean(fromSelf), {
                  senderId: dto.senderId,
                  sessionId: dto.keyRef ?? null,
                  senderDeviceId: dto.senderDeviceId ?? null,
                });
              } catch (decryptErr) {
                console.warn('Failed to decrypt history message', decryptErr);
                text = dto.body ?? DECRYPTION_PENDING_MESSAGE;
                failed = dto.body == null;
                debugBody = dto.body ?? null;
              }
            } else {
              text = dto.body ?? null;
            }
          } else if (dto.e2ee && encryptedPayload && sharedRoomKey) {
            try {
              text = await decryptMessage(encryptedPayload, sharedRoomKey);
            } catch (decryptErr) {
              console.warn('Failed to decrypt symmetric history message', decryptErr);
              text = dto.body ?? DECRYPTION_PENDING_MESSAGE;
              failed = dto.body == null;
              debugBody = dto.body ?? null;
            }
          } else if (dto.e2ee && encryptedPayload) {
            text = dto.body ?? null;
          }
          return {
            ...base,
            body: text,
            decryptionFailed: failed,
            debugBody,
            ciphertext: ciphertext ?? null,
            iv: iv ?? null,
            aad: aad ?? null,
            keyRef: dto.keyRef ?? null,
            senderDeviceId: dto.senderDeviceId ?? null,
          };
        }),
      );
      const deletedForUser = processed.filter(isDeletedForUser);
      const deletedIds = deletedForUser.map(message => message.messageId);
      const visibleMessages = processed.filter(
        message => !deletedIds.includes(message.messageId),
      );
      setRawMessages(prev => {
        let merged = prev.filter(message => !deletedIds.includes(message.messageId));
        for (const msg of visibleMessages) {
          merged = mergeIncomingMessage(merged, msg);
        }
        return merged;
      });
      if (roomId) {
        const records = visibleMessages.map(msg => toDbRecord(msg));
        try {
          await saveMessagesToDb(records);
        } catch (dbErr) {
          console.warn('Failed to persist history messages', dbErr);
        }
        if (deletedIds.length) {
          deleteMessagesFromDb(deletedIds).catch(err =>
            console.warn('Failed to delete messages removed for user', err),
          );
        }
      }
      const last = ordered[ordered.length - 1];
      if (last && resolvedRoomKey) {
        latestMessageIdRef.current = last.messageId;
        updateRoomActivity(resolvedRoomKey, {
          messageId: last.messageId,
          text: last.body ?? 'Encrypted message',
          at: last.serverTs ?? new Date().toISOString(),
          senderId: last.senderId,
        });
      }
      if (resolvedRoomKey) {
        resetUnread(resolvedRoomKey);
      }
    } catch (err) {
      console.warn('Failed to load room history', err);
      setError('Unable to load conversation');
    } finally {
      setIsLoading(false);
    }
  }, [
    roomId,
    resolvedRoomKey,
    updateRoomActivity,
    resetUnread,
    e2eeClient,
    currentUserId,
    sharedRoomKey,
    toDbRecord,
    saveMessagesToDb,
    deleteMessagesFromDb,
    isDeletedForUser,
  ]);

  const lastLoadedRef = useRef<{ roomId: number | null; key: string | null } | null>(null);

  useEffect(() => {
    if (!userLoaded) {
      return;
    }
    if (peerId && !e2eeReady) {
      return;
    }
    const lastLoaded = lastLoadedRef.current;
    const resolvedKey = resolvedRoomKey ?? null;
    if (lastLoaded && lastLoaded.roomId === roomId && lastLoaded.key === resolvedKey) {
      return;
    }

    lastLoadedRef.current = { roomId, key: resolvedKey };
    loadHistory();
  }, [loadHistory, userLoaded, peerId, e2eeReady, roomId, resolvedRoomKey]);

  useEffect(() => {
    if (!roomId || disableSubscriptions) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const sendPing = () =>
      stompClient
        .publish(`/app/room/${roomId}/ping`, {
          deviceId: 'mobile',
        })
        .catch(err => {
          console.warn('Failed to send presence ping', err);
        });

    stompClient
      .ensureConnected()
      .then(() => {
        if (cancelled) {
          return;
        }
        sendPing();
        timer = setInterval(sendPing, 15000);
      })
      .catch(err => {
        console.warn('Unable to establish STOMP connection for pings', err);
      });

    return () => {
      cancelled = true;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [disableSubscriptions, roomId]);

  const sendInboxDeliveryAck = useCallback(
    (messageId: string | null | undefined, status: 'DELIVERED' | 'READ') => {
      if (!messageId || !resolvedRoomKey) {
        return;
      }
      const deviceId = typeof e2eeClient?.getDeviceId === 'function' ? e2eeClient.getDeviceId() : undefined;
      stompClient
        .publish(sendInboxAck, {
          msgId: String(messageId),
          roomKey: resolvedRoomKey,
          status,
          deviceId,
        })
        .catch(err => console.warn('[WS][INBOX] ack failed', err));
    },
    [e2eeClient, resolvedRoomKey],
  );

  useEffect(() => {
    if (!roomId || !resolvedRoomKey || disableSubscriptions) {
      return;
    }

    let cancelled = false;
    stompClient
      .ensureConnected()
      .then(() => {
        if (cancelled) {
          return;
        }
        setIsConnected(true);
      })
      .catch(err => {
        if (!cancelled) {
          console.warn('Unable to connect to STOMP broker', err);
          setIsConnected(false);
        }
      });

     const messageSub = stompClient.subscribe(roomTopic(resolvedRoomKey), frame => {
      const payload = parseFrameBody(frame);
      if (!payload) {
        return;
      }
      const payloadRoomId =
        typeof payload.roomId === 'number' ? payload.roomId : Number(payload.roomId ?? roomId);
      const normalizedRoomId =
        payloadRoomId != null && !Number.isNaN(payloadRoomId) ? payloadRoomId : roomId;
        const payloadCiphertext = normalizeBinary(payload.ciphertext);
      const payloadIv = normalizeBinary(payload.iv);
      const payloadAad = normalizeBinary(payload.aad);
      const normalizedPayload = {
        ciphertext: payloadCiphertext ?? undefined,
        iv: payloadIv ?? undefined,
        aad: payloadAad ?? undefined,
        keyRef: payload.keyRef ?? undefined,
        e2ee: payload.e2ee,
        deletedBySender: payload.deletedBySender,
        deletedByReceiver: payload.deletedByReceiver,
        deletedForEveryone: payload.deletedForEveryone,
        systemMessage: payload.systemMessage,
      } as Partial<ChatMessageDto>;
      const base: InternalMessage = {
        messageId: payload.messageId,
        roomId: normalizedRoomId,
        senderId: payload.senderId ?? null,
        type: payload.type ?? MESSAGE_TYPE_TEXT,
        serverTs: payload.serverTs ?? new Date().toISOString(),
        pending: false,
        error: false,
        e2ee: Boolean(payload.e2ee),
        deletedBySender: payload.deletedBySender,
        deletedByReceiver: payload.deletedByReceiver,
        deletedForEveryone: payload.deletedForEveryone,
        systemMessage: payload.systemMessage,
      };
       const finalize = (
        text: string | null,
        failed = false,
        debugText: string | null = null,
      ) => {
        const merged = {
          ...base,
          body: text,
          decryptionFailed: failed,
          debugBody: failed ? debugText : null,
          ciphertext: payloadCiphertext ?? null,
          iv: payloadIv ?? null,
          aad: payloadAad ?? null,
          keyRef: payload.keyRef ?? null,
          senderDeviceId: payload.senderDeviceId ?? null,
        } as InternalMessage;
        if (isDeletedForUser(merged)) {
          setRawMessages(prev => prev.filter(message => message.messageId !== merged.messageId));
          deleteMessagesFromDb([merged.messageId]).catch(err =>
            console.warn('Failed to delete message removed for user', err),
          );
          return;
        }
        mergeMessage(merged);
        saveMessagesToDb([toDbRecord(merged, normalizedPayload)]).catch(err =>
          console.warn('Failed to persist incoming message', err),
        );
        latestMessageIdRef.current = base.messageId;
        updateRoomActivity(resolvedRoomKey, {
          messageId: base.messageId,
          text: text ?? 'Encrypted message',
          at: base.serverTs ?? new Date().toISOString(),
          senderId: base.senderId ?? null,
        });
        if (base.senderId != null && currentUserId != null && base.senderId !== currentUserId) {
          incrementUnread(resolvedRoomKey);
          const ackId = Number(payload.messageId);
          if (!Number.isNaN(ackId)) {
            stompClient
              .publish('/app/ack', { messageId: ackId })
              .catch(err => console.warn('Failed to acknowledge message delivery', err));
          }
          const deliveredId = base.messageId ? String(base.messageId) : null;
          if (deliveredId) {
            sendInboxDeliveryAck(deliveredId, 'DELIVERED');
          }
        }
      };

      const fallbackBody = payload.body ?? null;


      if (payload.e2ee) {
        const fromSelf = currentUserId != null && base.senderId === currentUserId;
        if (fromSelf) {
          const fallbackIsPending = fallbackBody === DECRYPTION_PENDING_MESSAGE;
          const selfUpdate: InternalMessage = {
            ...base,
            ...(fallbackBody != null ? { body: fallbackBody } : {}),
            decryptionFailed: fallbackIsPending,
            debugBody: fallbackIsPending ? fallbackBody : null,
            ciphertext: payloadCiphertext ?? null,
            iv: payloadIv ?? null,
            aad: payloadAad ?? null,
            keyRef: payload.keyRef ?? null,
            senderDeviceId: payload.senderDeviceId ?? null,
          };
          if (isDeletedForUser(selfUpdate)) {
            setRawMessages(prev => prev.filter(message => message.messageId !== selfUpdate.messageId));
            deleteMessagesFromDb([selfUpdate.messageId]).catch(err =>
              console.warn('Failed to delete message removed for user', err),
            );
            return;
          }
          mergeMessage(selfUpdate);
          saveMessagesToDb([toDbRecord(selfUpdate, normalizedPayload)]).catch(err =>
            console.warn('Failed to persist self-echo message', err),
          );
          updateMessageFlagsInDb(String(selfUpdate.messageId), {
            pending: false,
            error: false,
          }).catch(err => console.warn('Failed to clear pending flag for self-echo', err));
          return;
        }
        if (payloadCiphertext && payloadAad && payloadIv && payload.keyRef) {
          const envelope: E2EEEnvelope = {
            messageId: String(payload.messageId ?? ''),
            aad: payloadAad,
            iv: payloadIv,
            ciphertext: payloadCiphertext,
            keyRef: payload.keyRef,
          };
          if (e2eeClient) {
            e2eeClient
                .decryptEnvelope(envelope, false, {
                senderId: base.senderId ?? undefined,
                sessionId: payload.keyRef ?? null,
                senderDeviceId: payload.senderDeviceId ?? null,
              })
              .then(text => finalize(text))
              .catch(err => {
                console.warn('Failed to decrypt incoming message', err);
               if (SHOULD_LOG_DECRYPT) {
                  console.log('[CHAT] e2ee envelope fallback', {
                    messageId: base.messageId,
                    hasFallback: Boolean(fallbackBody),
                  });
                }
                finalize(
                  fallbackBody ?? DECRYPTION_PENDING_MESSAGE,
                  true,
                  fallbackBody ?? payload.body ?? null,
                );
              });
          } else {
             if (SHOULD_LOG_DECRYPT) {
              console.log('[CHAT] e2ee client unavailable, using fallback body', {
                messageId: base.messageId,
                hasFallback: Boolean(fallbackBody),
              });
            }
            const merged: InternalMessage = {
              ...base,
              body: fallbackBody,
              decryptionFailed: Boolean(payload.ciphertext),
              debugBody: fallbackBody,
              ciphertext: payloadCiphertext ?? null,
              iv: payloadIv ?? null,
              aad: payloadAad ?? null,
              keyRef: payload.keyRef ?? null,
              senderDeviceId: payload.senderDeviceId ?? null,
            };
            if (isDeletedForUser(merged)) {
              setRawMessages(prev => prev.filter(message => message.messageId !== merged.messageId));
              deleteMessagesFromDb([merged.messageId]).catch(err =>
                console.warn('Failed to delete message removed for user', err),
              );
              return;
            }
            mergeMessage(merged);
            saveMessagesToDb([toDbRecord(merged, normalizedPayload)]).catch(err =>
              console.warn('Failed to persist incoming message', err),
            );
          }
          return;
        }

        if (payloadCiphertext && payloadIv && sharedRoomKey) {
          const encrypted: EncryptedPayload = {
            ciphertext: payloadCiphertext,
            iv: payloadIv,
            aad: payloadAad ?? undefined,
          };
          decryptMessage(encrypted, sharedRoomKey)
            .then(text => finalize(text))
            .catch(err => {
              console.warn('Failed to decrypt symmetric incoming message', err);
              if (SHOULD_LOG_DECRYPT) {
                console.log('[CHAT] symmetric decrypt fallback', {
                  messageId: base.messageId,
                  hasFallback: Boolean(fallbackBody),
                });
              }
              finalize(fallbackBody ?? DECRYPTION_PENDING_MESSAGE, true, fallbackBody);
            });
          return;
        }
        const merged: InternalMessage = {
          ...base,
          body: fallbackBody,
          decryptionFailed: Boolean(payload.ciphertext),
          debugBody: fallbackBody,
          ciphertext: payloadCiphertext ?? null,
          iv: payloadIv ?? null,
          aad: payloadAad ?? null,
          keyRef: payload.keyRef ?? null,
          senderDeviceId: payload.senderDeviceId ?? null,
        };
        if (isDeletedForUser(merged)) {
          setRawMessages(prev => prev.filter(message => message.messageId !== merged.messageId));
          deleteMessagesFromDb([merged.messageId]).catch(err =>
            console.warn('Failed to delete message removed for user', err),
          );
          return;
        }
        mergeMessage(merged);
        saveMessagesToDb([toDbRecord(merged, normalizedPayload)]).catch(err =>
          console.warn('Failed to persist incoming message', err),
        );
        if (base.senderId != null && currentUserId != null && base.senderId !== currentUserId) {
          const deliveredId = base.messageId ? String(base.messageId) : null;
          if (deliveredId) {
            sendInboxDeliveryAck(deliveredId, 'DELIVERED');
          }
        }
        return;
      }
      finalize(payload.body ?? null);
    });

    const ackSub = stompClient.subscribe(ackQueue, frame => {
      const payload = parseFrameBody(frame);
       if (!payload) {
        return;
      }
      const payloadRoomId =
        typeof payload.roomId === 'number' ? String(payload.roomId) : payload.roomId ?? null;
      if (!payloadRoomId || payloadRoomId !== resolvedRoomKey) {
        return;
      }
      const ackMessageId = payload.messageId ? String(payload.messageId) : null;
      if (!ackMessageId) {
        return;
      }
      const deliveryStatus =
        typeof payload.deliveryStatus === 'string' ? payload.deliveryStatus : 'SENT_TO_WS';
      const isReadStatus = deliveryStatus === 'READ';
      mergeMessage({
        messageId: ackMessageId,
        roomId: roomId,
        senderId: currentUserId,
        type: MESSAGE_TYPE_TEXT,
        serverTs: payload.serverTs,
        pending: false,
        error: false,
        deliveryStatus,
        readByPeer: isReadStatus ? true : undefined,
      });
       updateMessageFlagsInDb(ackMessageId, {
        pending: false,
        error: false,
        ...(isReadStatus ? { readByPeer: true } : {}),
      }).catch(err =>
        console.warn('Failed to clear pending flag for message', err),
      );
    });

    const typingSub = stompClient.subscribe(roomTypingTopic(roomId), frame => {
      const payload = parseFrameBody(frame);
      if (!payload || typeof payload.userId !== 'number') {
        return;
      }
      if (currentUserId != null && payload.userId === currentUserId) {
        return;
      }
      const expiresAt = payload.expiresAt ? new Date(payload.expiresAt).getTime() : Date.now() + 5000;
      setTyping(prev => {
        const filtered = prev.filter(t => t.userId !== payload.userId);
        if (payload.typing === false) {
          return filtered;
        }
        return [...filtered, { userId: payload.userId, expiresAt }];
      });
    });

    const readSub = stompClient.subscribe(roomReadTopic(roomId), frame => {
      const payload = parseFrameBody(frame);
      if (!payload || payload.userId == null) {
        return;
      }
      if (currentUserId != null && payload.userId === currentUserId) {
        if (resolvedRoomKey) {
          resetUnread(resolvedRoomKey);
        }
      }
    });

    const subs: (() => void)[] = [messageSub, ackSub, typingSub, readSub];

    if (peerId != null) {
      const dmTypingSub = stompClient.subscribe(dmTypingQueue, frame => {
        const payload = parseFrameBody(frame);
        if (!payload || payload.senderId == null) {
          return;
        }
        const sender = typeof payload.senderId === 'number' ? payload.senderId : Number(payload.senderId);
        if (sender !== peerId) {
          return;
        }
        const expiresAt = Date.now() + 5000;
        setTyping(prev => {
          const filtered = prev.filter(t => t.userId !== sender);
          return [...filtered, { userId: sender, expiresAt }];
        });
      });

      const dmReadSub = stompClient.subscribe(dmReceiptQueue, frame => {
        const payload = parseFrameBody(frame);
        if (!payload) {
          return;
        }
        const sender = typeof payload.senderId === 'number' ? payload.senderId : Number(payload.senderId);
        const payloadRoomId =
          typeof payload.roomId === 'number' ? payload.roomId : Number(payload.roomId ?? roomId);
        if (Number.isNaN(payloadRoomId) || sender !== peerId || payloadRoomId !== roomId) {
          return;
        }
        const messageKey = String(payload.messageId ?? '');
        if (!messageKey) {
          return;
        }
        setRawMessages(prev =>
          prev.map(msg =>
            msg.messageId === messageKey
              ? {
                  ...msg,
                  readByPeer: true,
                  deliveryStatus: 'READ',
                }
              : msg,
          ),
        );
        if (payload.messageId) {
        updateMessageFlagsInDb(String(payload.messageId), { pending: false, error: false }).catch(err =>
          console.warn('Failed to clear pending flag for message', err),
        );
      }
      });
      subs.push(dmTypingSub, dmReadSub);
    }
    subscriptionsRef.current = subs;

    return () => {
      cancelled = true;
      setIsConnected(false);
      subscriptionsRef.current.forEach(unsub => unsub());
      subscriptionsRef.current = [];
    };
 }, [
    roomId,
    resolvedRoomKey,
    disableSubscriptions,
    mergeMessage,
    updateRoomActivity,
    incrementUnread,
    resetUnread,
    currentUserId,
    peerId,
    e2eeClient,
    sharedRoomKey,
    toDbRecord,
    saveMessagesToDb,
    deleteMessagesFromDb,
    updateMessageFlagsInDb,
    isDeletedForUser,
    sendInboxDeliveryAck,
  ]);

  useEffect(() => {
    if (!typing.length) {
      return;
    }
    const now = Date.now();
    const next = typing.filter(entry => entry.expiresAt > now);
    if (next.length !== typing.length) {
      setTyping(next);
    }
    const timer = setTimeout(() => {
      setTyping(prev => prev.filter(entry => entry.expiresAt > Date.now()));
    }, 1500);
    return () => clearTimeout(timer);
  }, [typing]);

  const rebuildCryptoSession = useCallback(async () => {
    try {
      const client = await getE2EEClient();
      setE2eeClient(client);
      let key: string | null = null;
      if (resolvedRoomKey) {
        key = await ensureSharedRoomKey(resolvedRoomKey);
        setSharedRoomKey(key);
      }
      return { client, sharedKey: key ?? sharedRoomKey };
    } catch (err) {
      console.warn('Failed to rebuild secure session', err);
      return { client: e2eeClient, sharedKey: sharedRoomKey };
    }
  }, [resolvedRoomKey, e2eeClient, sharedRoomKey]);

  const retryDecryptMessage = useCallback(
    async (message: DisplayMessage): Promise<string | null> => {
      const hasCiphertext = Boolean(message.raw?.ciphertext) && Boolean(message.raw?.iv);
      if (!hasCiphertext) {
        if (__DEV__ && message.raw?.debugBody) {
          return message.raw.debugBody;
        }
        return null;
      }

      const { client, sharedKey } = await rebuildCryptoSession();
      const keyToUse = sharedKey ?? sharedRoomKey;
      try {
        let decrypted: string | null = null;
        if (
          message.raw?.keyRef &&
          client &&
          message.raw.ciphertext &&
          message.raw.iv &&
          message.raw.aad
        ) {
          const envelope: E2EEEnvelope = {
            messageId: message.messageId,
            aad: message.raw.aad,
            iv: message.raw.iv,
            ciphertext: message.raw.ciphertext,
            keyRef: message.raw.keyRef,
          };
          const fromSelf = currentUserId != null && message.senderId === currentUserId;
          decrypted = await client.decryptEnvelope(envelope, Boolean(fromSelf), {
            senderId: message.senderId ?? undefined,
            sessionId: message.raw.keyRef ?? null,
            senderDeviceId: message.raw.senderDeviceId ?? null,
          });
        } else if (keyToUse && message.raw?.ciphertext && message.raw?.iv) {
          decrypted = await decryptMessage(
            {
              ciphertext: message.raw.ciphertext,
              iv: message.raw.iv,
              aad: message.raw.aad ?? undefined,
            },
            keyToUse,
          );
        }

        if (!decrypted && __DEV__ && message.raw?.debugBody) {
          decrypted = message.raw.debugBody;
        }

        if (!decrypted) {
          return null;
        }

        setRawMessages(prev =>
          prev.map(msg =>
            msg.messageId === message.id
              ? { ...msg, body: decrypted, decryptionFailed: false, debugBody: null }
              : msg,
          ),
        );

        const existing = rawMessages.find(msg => msg.messageId === message.id) ?? message.raw;
        const merged: InternalMessage = {
          ...existing,
          body: decrypted,
          decryptionFailed: false,
          debugBody: null,
        };
        const payload = {
          ciphertext: merged.ciphertext ?? undefined,
          aad: merged.aad ?? undefined,
          iv: merged.iv ?? undefined,
          keyRef: merged.keyRef ?? undefined,
          senderDeviceId: merged.senderDeviceId ?? undefined,
          e2ee: merged.e2ee,
        };
        saveMessagesToDb([toDbRecord(merged, payload)]).catch(err =>
          console.warn('Failed to persist retried decryption', err),
        );

        return decrypted;
      } catch (err) {
        console.warn('Retry decryption failed', err);
        if (__DEV__ && message.raw?.debugBody) {
          return message.raw.debugBody;
        }
        return null;
      }
    },
    [
      currentUserId,
      rebuildCryptoSession,
      rawMessages,
      saveMessagesToDb,
      sharedRoomKey,
      toDbRecord,
    ],
  );

  const displayMessages: DisplayMessage[] = useMemo(() => {
    return rawMessages
      .slice()
      .sort((a, b) => {
        const aTime = a.serverTs ?? '';
        const bTime = b.serverTs ?? '';
        if (aTime === bTime) {
          return a.messageId.localeCompare(b.messageId);
        }
        return aTime.localeCompare(bTime);
      })
      .map(msg => {
        const isFromCurrentUser =
          (currentUserId != null && msg.senderId === currentUserId) ||
          (msg.senderId == null && msg.pending);
        const sender: 'me' | 'other' = isFromCurrentUser ? 'me' : 'other';
        return {
          id: msg.messageId,
          messageId: msg.messageId,
          roomId: msg.roomId,
          senderId: msg.senderId ?? null,
          sender,
          text: msg.body,
          time: formatTime(msg.serverTs),
          serverTs: msg.serverTs,
          pending: msg.pending,
          failed: msg.error,
          raw: msg,
          readByPeer: msg.readByPeer,
        };
      });
  }, [rawMessages, currentUserId]);

  const sendTypingUpdate = useCallback(
    (isTyping: boolean) => {
      if (!roomId) {
        return;
      }
      stompClient.publish(sendRoomTyping(roomId), {
        typing: isTyping,
        deviceId: 'mobile',
      });
      if (peerId != null) {
        stompClient.publish(sendDirectTyping(peerId), {
          roomId,
          typing: isTyping,
        });
      }
    },
    [roomId, peerId],
  );

  const notifyTyping = useCallback(
    (isTyping: boolean) => {
      if (!roomId) {
        return;
      }

      if (isTyping) {
        if (!typingSentRef.current) {
          typingSentRef.current = true;
          sendTypingUpdate(true);
        }
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          typingSentRef.current = false;
          sendTypingUpdate(false);
        }, 3000);
      } else if (typingSentRef.current) {
        typingSentRef.current = false;
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
        sendTypingUpdate(false);
      }
    },
    [roomId, sendTypingUpdate],
  );

  const sendTextMessage = useCallback(
    async (text: string, replyMetadata?: ReplyMetadata) => {
      if (!resolvedRoomKey || !text.trim()) {
        return { success: false as const };
      }
      setError(null);
      const resolvedRoomId =
        roomId ?? (resolvedRoomKey ? Number(resolvedRoomKey) : null);
      const normalizedRoomId = Number.isNaN(resolvedRoomId ?? NaN) ? null : resolvedRoomId;
      const body = text.trim();
      const normalizedReply = replyMetadata
        ? {
            replyToMessageId: replyMetadata.messageId ?? null,
            replyToSenderId:
              replyMetadata.senderId != null
                ? replyMetadata.senderId
                : replyMetadata.isMine && currentUserId != null
                  ? currentUserId
                  : null,
            replyToPreview: replyMetadata.previewText ?? null,
          }
        : null;
      const messageId = generateMessageId();
      const nowIso = new Date().toISOString();
      let derivedSharedKey = sharedRoomKey;

      const logEncryptionUnavailable = (reason: string, details?: Record<string, unknown>) => {
        if (SHOULD_LOG_E2EE) {
          console.debug('[CHAT][E2EE] encryption unavailable', {
            reason,
            roomKey: resolvedRoomKey ?? null,
            peerId: peerId ?? null,
            ...details,
          });
        }
      };

      if (!peerId && !derivedSharedKey && resolvedRoomKey) {
        try {
          derivedSharedKey = await ensureSharedRoomKey(resolvedRoomKey);
          setSharedRoomKey(current => current ?? derivedSharedKey);
        } catch (keyErr) {
          console.warn('Failed to derive shared key before sending', keyErr);
          logEncryptionUnavailable('ensure-shared-room-key-failed', {
            error: keyErr instanceof Error ? keyErr.message : String(keyErr),
          });
        }
      }

      if (peerId != null && !e2eeClient) {
        logEncryptionUnavailable('missing-e2ee-client');
        setError('Unable to send secure message. Please try again.');
        return { success: false as const };
      }

      if (peerId == null && !derivedSharedKey) {
        logEncryptionUnavailable('missing-peer-id');
        setError('Unable to send secure message. Please try again.');
        return { success: false as const };
      }

      let payload: Record<string, unknown> | null = null;
      if (peerId != null && e2eeClient) {
        try {
          const encrypted = await e2eeClient.encryptForUser(peerId, messageId, body);
          if (!encrypted) {
            logEncryptionUnavailable('missing-peer-device', { peerId });
            setError('Unable to send secure message. Please try again.');
            return { success: false as const };
          }
          payload = {
            messageId,
            type: MESSAGE_TYPE_TEXT,
            e2ee: true,
            body,
            e2eeVer: encrypted.envelope.e2eeVer,
            algo: encrypted.envelope.algo,
            aad: encrypted.envelope.aad,
            iv: encrypted.envelope.iv,
            ciphertext: encrypted.envelope.ciphertext,
            keyRef: encrypted.envelope.keyRef,
            senderDeviceId: encrypted.envelope.senderDeviceId,
          };
        } catch (encryptErr) {
          console.warn('Failed to encrypt message', encryptErr);
          logEncryptionUnavailable('encrypt-failed', {
            error: encryptErr instanceof Error ? encryptErr.message : String(encryptErr),
          });
          setError('Unable to send secure message. Please try again.');
          return { success: false as const };
        }
      } else if (derivedSharedKey) {
        try {
          const encrypted = await encryptMessage(body, derivedSharedKey);
          payload = {
            messageId,
            type: MESSAGE_TYPE_TEXT,
            e2ee: true,
            body,
            algo: 'XSalsa20-Poly1305',
            iv: encrypted.iv,
            ciphertext: encrypted.ciphertext,
          };
        } catch (encryptErr) {
          console.warn('Failed to encrypt symmetric message', encryptErr);
          logEncryptionUnavailable('symmetric-encrypt-failed', {
            error: encryptErr instanceof Error ? encryptErr.message : String(encryptErr),
          });
          setError('Unable to send secure message. Please try again.');
          return { success: false as const };
        }
      }

      if (!payload) {
        logEncryptionUnavailable('missing-payload');
        setError('Unable to send secure message. Please try again.');
        return { success: false as const };
      }

      const optimistic: InternalMessage = {
        messageId,
        roomId: normalizedRoomId,
        senderId: currentUserId,
        type: MESSAGE_TYPE_TEXT,
        body,
        ...(normalizedReply ?? {}),
        serverTs: nowIso,
        pending: true,
        error: false,
        readByPeer: false,
        e2ee: true,
      };
      mergeMessage(optimistic);
      latestMessageIdRef.current = messageId;
      updateRoomActivity(resolvedRoomKey, {
        messageId,
        text: body,
        at: nowIso,
        senderId: currentUserId ?? undefined,
      });
      resetUnread(resolvedRoomKey);
      try {

        try {
          await saveMessagesToDb([
            toDbRecord({ ...optimistic, body }, payload ?? undefined, normalizedRoomId),
          ]);
        } catch (dbErr) {
          console.warn('Failed to persist outgoing message', dbErr);
        }
        
        console.log('[CHAT] sending text via STOMP', {
          roomId,
          roomKey: resolvedRoomKey,
          destination: sendRoomMessage(resolvedRoomKey),
          payload,
        });

        await stompClient.publish(sendRoomMessage(resolvedRoomKey), payload);

        console.log('[CHAT] STOMP publish resolved for', messageId);
        return { success: true as const, messageId };
      } catch (err) {
        console.warn('Failed to send message', err);
        mergeMessage({
          ...optimistic,
          pending: false,
          error: true,
        });
        await updateMessageFlagsInDb(messageId, { pending: false, error: true }).catch(dbErr =>
          console.warn('Failed to persist failed send status', dbErr),
        );
        return { success: false as const, messageId };
      }
    },
    [
      roomId,
      resolvedRoomKey,
      currentUserId,
      mergeMessage,
      updateRoomActivity,
      resetUnread,
      peerId,
      e2eeClient,
      sharedRoomKey,
      toDbRecord,
      saveMessagesToDb,
      updateMessageFlagsInDb,
    ],
  );

  const markLatestRead = useCallback(async () => {
    if (!roomId || !resolvedRoomKey) {
      return;
    }
    const lastMessageId = latestMessageIdRef.current;
    if (!lastMessageId) {
      return;
    }
    try {
      await markRoomRead(roomId, lastMessageId);
      await stompClient.publish(sendRoomRead(roomId), {
        lastReadMessageId: lastMessageId,
      });
      if (peerId != null) {
        await stompClient.publish(sendDirectRead(peerId), {
          roomId,
          messageId: lastMessageId,
        });
      }
      sendInboxDeliveryAck(lastMessageId, 'READ');
      resetUnread(resolvedRoomKey);
    } catch (err) {
      console.warn('Failed to mark messages as read', err);
    }
  }, [roomId, resolvedRoomKey, resetUnread, peerId, sendInboxDeliveryAck]);

  const typingUsers = useMemo(
    () =>
      typing
        .filter(entry => (currentUserId == null ? true : entry.userId !== currentUserId))
        .map(entry => entry.userId),
    [typing, currentUserId],
  );

  return {
    messages: displayMessages,
    isLoading,
    isConnected,
    error,
    sendTextMessage,
    notifyTyping,
    markLatestRead,
    typingUsers,
    currentUserId,
    retryDecryptMessage,
  } as const;
};

export type ChatSessionHook = ReturnType<typeof useChatSession>;