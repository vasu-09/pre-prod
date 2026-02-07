import stompClient, { StompFrame } from './stompClient';

export type CallSignalEvent = {
  type?: string;
  event?: string;
  [key: string]: any;
};

export type TurnCredentials = {
  username?: string;
  credential?: string;
  ttl?: number;
  uris?: string[];
  [key: string]: any;
};

const parseFrame = (frame: StompFrame) => {
  try {
    return frame.body ? JSON.parse(frame.body) : null;
  } catch (err) {
    console.warn('Failed to parse call signaling frame', err);
    return null;
  }
};

const noop = () => {};

const ensureArray = (value: unknown): number[] => {
  if (Array.isArray(value)) {
    return value
      .map(entry => (typeof entry === 'number' ? entry : Number(entry)))
      .filter(entry => !Number.isNaN(entry));
  }
  return [];
};

const callSignaling = {
  invite(roomId: number | string | null | undefined, calleeIds: number[]) {
    if (!roomId) {
      return Promise.reject(new Error('roomId is required for call invite'));
    }
    return stompClient.publish(`/app/call/invite/${roomId}`, { calleeIds });
  },
  inviteGroup(roomId: number | string | null | undefined, calleeIds: number[]) {
    if (!roomId) {
      return Promise.reject(new Error('roomId is required for group call invite'));
    }
    return stompClient.publish(`/app/call/invite/group/${roomId}`, { calleeIds });
  },
  join(callId: number | string | null | undefined) {
    if (!callId) {
      return Promise.reject(new Error('callId is required to join call'));
    }
    return stompClient.publish(`/app/call/join/${callId}`, {});
  },
  leave(callId: number | string | null | undefined) {
    if (!callId) {
      return Promise.reject(new Error('callId is required to leave call'));
    }
    return stompClient.publish(`/app/call/leave/${callId}`, {});
  },
  ringing(callId: number | string | null | undefined) {
    if (!callId) {
      return Promise.reject(new Error('callId is required to mark ringing'));
    }
    return stompClient.publish(`/app/call/ringing/${callId}`, {});
  },
  answer(callId: number | string | null | undefined, sdp: string) {
    if (!callId) {
      return Promise.reject(new Error('callId is required to answer call'));
    }
    return stompClient.publish(`/app/call/answer/${callId}`, { sdp });
  },
  decline(callId: number | string | null | undefined) {
    if (!callId) {
      return Promise.reject(new Error('callId is required to decline call'));
    }
    return stompClient.publish(`/app/call/decline/${callId}`, {});
  },
  end(callId: number | string | null | undefined) {
    if (!callId) {
      return Promise.reject(new Error('callId is required to end call'));
    }
    return stompClient.publish(`/app/call/end/${callId}`, {});
  },
  candidate(callId: number | string | null | undefined, candidate: string) {
    if (!callId) {
      return Promise.reject(new Error('callId is required to send candidate'));
    }
    return stompClient.publish(`/app/call/candidate/${callId}`, { candidate });
  },
  reinvite(callId: number | string | null | undefined) {
    if (!callId) {
      return Promise.reject(new Error('callId is required to request re-invite'));
    }
    return stompClient.publish(`/app/call/reinvite/${callId}`, {});
  },
  fail(callId: number | string | null | undefined) {
    if (!callId) {
      return Promise.reject(new Error('callId is required to report failure'));
    }
    return stompClient.publish(`/app/call/fail/${callId}`, {});
  },
  subscribeRoom(roomId: number | string | null | undefined, callback: (event: CallSignalEvent) => void) {
    if (!roomId) {
      return noop;
    }
    return stompClient.subscribe(`/topic/call.room/${roomId}`, frame => {
      const payload = parseFrame(frame);
      if (payload) {
        if (Array.isArray(payload.callees)) {
          payload.callees = ensureArray(payload.callees);
        }
        callback(payload);
      }
    });
  },
  subscribeCall(callId: number | string | null | undefined, callback: (event: CallSignalEvent) => void) {
    if (!callId) {
      return noop;
    }
    return stompClient.subscribe(`/topic/call/${callId}`, frame => {
      const payload = parseFrame(frame);
      if (payload) {
        callback(payload);
      }
    });
  },
  subscribeQueue(callback: (event: CallSignalEvent) => void) {
    return stompClient.subscribe('/user/queue/call', frame => {
      const payload = parseFrame(frame);
      if (payload) {
        if (Array.isArray(payload.users)) {
          payload.users = ensureArray(payload.users);
        }
        callback(payload);
      }
    });
  },
  subscribeTurn(callback: (credentials: TurnCredentials) => void) {
    return stompClient.subscribe('/user/queue/turn', frame => {
      const payload = parseFrame(frame);
      if (payload) {
        callback(payload);
      }
    });
  },
};

export default callSignaling;