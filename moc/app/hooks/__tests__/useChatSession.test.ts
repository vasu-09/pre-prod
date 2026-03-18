import { mergeIncomingMessage, type InternalMessage } from '../messageMerging';

describe('mergeIncomingMessage', () => {
  const baseMessage: InternalMessage = {
    messageId: 'm1',
    roomId: 1,
    senderId: 1,
    type: 'TEXT',
    body: 'Hello world',
    serverTs: '2025-01-01T00:00:00.000Z',
    pending: true,
    error: false,
  };

  it('preserves the existing body when an update lacks plaintext', () => {
    const incoming: InternalMessage = {
      messageId: 'm1',
      roomId: 1,
      senderId: 1,
      type: 'TEXT',
      serverTs: '2025-01-01T00:00:01.000Z',
      pending: false,
      error: false,
      ciphertext: 'cipher',
      iv: 'iv',
      aad: 'aad',
      keyRef: 'key',
    };

    const [merged] = mergeIncomingMessage([baseMessage], incoming);

    expect(merged.body).toBe('Hello world');
    expect(merged.pending).toBe(false);
    expect(merged.ciphertext).toBe('cipher');
  });

  it('allows the body to be cleared explicitly', () => {
    const incoming: InternalMessage = {
      messageId: 'm1',
      roomId: 1,
      senderId: 1,
      type: 'TEXT',
      body: null,
      serverTs: '2025-01-01T00:00:02.000Z',
      pending: false,
      error: false,
    };

    const [merged] = mergeIncomingMessage([baseMessage], incoming);

    expect(merged.body).toBeNull();
    expect(merged.pending).toBe(false);
  });
});