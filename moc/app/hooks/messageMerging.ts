export type InternalMessage = {
  messageId: string;
  roomId: number | null;
  senderId: number | null;
  type: string;
  body?: string | null;
  replyToMessageId?: string | null;
  replyToSenderId?: number | null;
  replyToPreview?: string | null;
  serverTs?: string | null;
  ciphertext?: string | null;
  iv?: string | null;
  aad?: string | null;
  keyRef?: string | null;
  pending?: boolean;
  error?: boolean;
  readByPeer?: boolean;
  deliveryStatus?: string;
  deletedBySender?: boolean;
  deletedByReceiver?: boolean;
  deletedForEveryone?: boolean;
  systemMessage?: boolean;
  decryptionFailed?: boolean;
  e2ee?: boolean;
  debugBody?: string | null;
};

export const mergeIncomingMessage = (
  prev: InternalMessage[],
  incoming: InternalMessage,
): InternalMessage[] => {
  const idx = prev.findIndex(m => m.messageId === incoming.messageId);
  if (idx >= 0) {
    const next = [...prev];
    const existing = next[idx];
    next[idx] = {
      ...existing,
      ...incoming,
      body: incoming.body !== undefined ? incoming.body : existing.body,
      serverTs: incoming.serverTs ?? existing.serverTs,
      ciphertext: incoming.ciphertext ?? existing.ciphertext,
      aad: incoming.aad ?? existing.aad,
      iv: incoming.iv ?? existing.iv,
      keyRef: incoming.keyRef ?? existing.keyRef,
      readByPeer: incoming.readByPeer ?? existing.readByPeer,
      deliveryStatus: incoming.deliveryStatus ?? existing.deliveryStatus,
      deletedBySender: incoming.deletedBySender ?? existing.deletedBySender,
      deletedByReceiver: incoming.deletedByReceiver ?? existing.deletedByReceiver,
      deletedForEveryone: incoming.deletedForEveryone ?? existing.deletedForEveryone,
      systemMessage: incoming.systemMessage ?? existing.systemMessage,
      debugBody: incoming.debugBody ?? existing.debugBody,
      decryptionFailed: incoming.decryptionFailed ?? existing.decryptionFailed,
      replyToMessageId: incoming.replyToMessageId ?? existing.replyToMessageId,
      replyToSenderId: incoming.replyToSenderId ?? existing.replyToSenderId,
      replyToPreview: incoming.replyToPreview ?? existing.replyToPreview,
    };
    return next;
  }
  return [
    ...prev,
    {
      ...incoming,
      readByPeer: incoming.readByPeer ?? false,
    },
  ];
};