import { render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { MessageContent } from '../ChatDetailScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({
    roomId: '1',
    roomKey: 'abc',
    title: 'Test Chat',
    peerId: '2',
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

jest.mock('expo-audio', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    setAudioModeAsync: jest.fn(),
    Recording: { createAsync: jest.fn(), OptionsPresets: { HIGH_QUALITY: {} } },
    Sound: {
      createAsync: jest.fn(async () => ({
        sound: {
          replayAsync: jest.fn(),
          setOnPlaybackStatusUpdate: jest.fn(),
        },
      })),
    },
  },
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('../../hooks/useCallSignaling', () => ({
  __esModule: true,
  default: () => ({ sendInviteDefault: jest.fn() }),
}));
jest.mock('../../services/apiClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));
jest.mock('../../services/stompClient', () => ({
  __esModule: true,
  default: {
    ensureConnected: jest.fn(() => Promise.resolve()),
    subscribe: jest.fn(() => jest.fn()),
    publish: jest.fn(() => Promise.resolve()),
    onConnect: jest.fn(() => jest.fn()),
  },
}));
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('../../hooks/useChatSession', () => ({
  useChatSession: jest.fn(() => ({
    messages: [],
    sendTextMessage: jest.fn(),
    notifyTyping: jest.fn(),
    markLatestRead: jest.fn(),
    typingUsers: [],
    isLoading: false,
    error: null,
    currentUserId: 99,
  })),
}));

describe('MessageContent', () => {
  it('renders sent message text with timestamp', () => {
    const message = {
      id: 'm1',
      messageId: 'm1',
      roomId: 1,
      senderId: 99,
      sender: 'me' as const,
      text: 'Hello world',
      time: '10:00',
      pending: false,
      failed: false,
      raw: {
        messageId: 'm1',
        roomId: 1,
        senderId: 99,
        type: 'TEXT',
        body: 'Hello world',
        decryptionFailed: false,
      },
    };

    const { getByText } = render(
      <MessageContent
        item={message}
        playingMessageId={null}
        onTogglePlayback={jest.fn()}
        onRetryDecrypt={jest.fn(async () => null)}
      />,
    );

    expect(getByText('Hello world')).toBeTruthy();
    expect(getByText('10:00')).toBeTruthy();
  });

    
    it('retries decrypting and displays recovered text', async () => {
    const message = {
      id: 'm2',
      messageId: 'm2',
      roomId: 1,
      senderId: 42,
      sender: 'other' as const,
      text: null,
      time: '11:00',
      pending: false,
      failed: true,
      raw: {
        messageId: 'm2',
        roomId: 1,
        senderId: 42,
        type: 'TEXT',
        body: 'Original raw message',
        decryptionFailed: true,
        ciphertext: 'abc',
        iv: 'iv',
        aad: 'aad',
        keyRef: 'k',
      },
    };

    const retryDecrypt = jest.fn(async () => 'Recovered text');

    const { getByText } = render(
      <MessageContent
        item={message}
        playingMessageId={null}
        onTogglePlayback={jest.fn()}
        onRetryDecrypt={retryDecrypt}
      />,
    );

    expect(getByText('Waiting for this message. This may take a while.')).toBeTruthy();
    expect(getByText('Learn more')).toBeTruthy();

    await waitFor(() => expect(getByText('Recovered text')).toBeTruthy());
    expect(retryDecrypt).toHaveBeenCalledTimes(1);
    expect(getByText('Recovered text')).toBeTruthy();
  });

  it('keeps the waiting message when retry fails', async () => {
    const message = {
      id: 'm3',
      messageId: 'm3',
      roomId: 1,
      senderId: 1,
      sender: 'other' as const,
      text: null,
      time: '11:05',
      pending: false,
      failed: true,
      raw: {
        messageId: 'm3',
        roomId: 1,
        senderId: 1,
        type: 'TEXT',
        body: 'Raw text from payload',
        decryptionFailed: true,
        ciphertext: 'abc',
        iv: 'iv',
      },
    };

    const { getByText } = render(
      <MessageContent
        item={message}
        playingMessageId={null}
        onTogglePlayback={jest.fn()}
        onRetryDecrypt={jest.fn(async () => null)}
      />,
    );

    await waitFor(() => expect(getByText('Waiting for this message. This may take a while.')).toBeTruthy());
    expect(getByText('Learn more')).toBeTruthy();
  });
});
