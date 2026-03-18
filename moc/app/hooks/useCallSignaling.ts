import { useCallback, useEffect, useRef } from 'react';

import callSignaling, {
  CallAnswerPayload,
  CallCandidatePayload,
  CallOfferPayload,
  CallSignalEvent,
  TurnCredentials,
} from '../services/callSignaling';

export type UseCallSignalingOptions = {
  roomId?: number | null;
  callId?: number | null;
  onRoomEvent?: (event: CallSignalEvent) => void;
  onCallEvent?: (event: CallSignalEvent) => void;
  onBufferedCallEvent?: (event: CallSignalEvent) => void;
  onQueueEvent?: (event: CallSignalEvent) => void;
  onTurnCredentials?: (credentials: TurnCredentials) => void;
};

const ensureNumber = (value: number | string | null | undefined) => {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? undefined : value;
  }
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

export const useCallSignaling = (options: UseCallSignalingOptions = {}) => {
  const {
    roomId,
    callId,
    onRoomEvent,
    onCallEvent,
    onBufferedCallEvent,
    onQueueEvent,
    onTurnCredentials,
  } = options;

  const onRoomEventRef = useRef<typeof onRoomEvent>(onRoomEvent);
  const onCallEventRef = useRef<typeof onCallEvent>(onCallEvent);
  const onBufferedCallEventRef = useRef<typeof onBufferedCallEvent>(onBufferedCallEvent);
  const onQueueEventRef = useRef<typeof onQueueEvent>(onQueueEvent);
  const onTurnCredentialsRef = useRef<typeof onTurnCredentials>(onTurnCredentials);

  useEffect(() => {
    onRoomEventRef.current = onRoomEvent;
  }, [onRoomEvent]);

  useEffect(() => {
    onCallEventRef.current = onCallEvent;
  }, [onCallEvent]);

  useEffect(() => {
    onBufferedCallEventRef.current = onBufferedCallEvent;
  }, [onBufferedCallEvent]);

  useEffect(() => {
      onQueueEventRef.current = onQueueEvent;
    }, [onQueueEvent]);

    useEffect(() => {
      onTurnCredentialsRef.current = onTurnCredentials;
    }, [onTurnCredentials]);

    useEffect(() => {
      if (!roomId || !onRoomEventRef.current) {
      return;
    }
    return callSignaling.subscribeRoom(roomId, event => {
      onRoomEventRef.current?.(event);
    });
  }, [roomId]);

  useEffect(() => {
    if (!callId || !onCallEventRef.current) {
      return;
    }
    return callSignaling.subscribeCall(callId, event => {
      onCallEventRef.current?.(event);
    });
  }, [callId]);

  useEffect(() => {
    if (!callId || !onBufferedCallEventRef.current) {
      return;
    }
    return callSignaling.subscribeBufferedCallQueue(callId, event => {
      onBufferedCallEventRef.current?.(event);
    });
  }, [callId]);

  useEffect(() => {
    if (!onQueueEventRef.current) {
      return;
    }
    const unsubscribe = callSignaling.subscribeQueue(event => {
      onQueueEventRef.current?.(event);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!onTurnCredentialsRef.current) {
      return;
    }
    const unsubscribe = callSignaling.subscribeTurn(credentials => {
      onTurnCredentialsRef.current?.(credentials);
    });
  }, []);

  const sendInvite = useCallback(
    (
      targetRoomId: number,
      calleeIds: number[],
      { group, mode }: { group?: boolean; mode?: 'audio' | 'video' } = {},
    ) => {
      if (!targetRoomId || !Array.isArray(calleeIds) || !calleeIds.length) {
        return Promise.reject(new Error('A valid room id and at least one callee are required'));
      }
      const metadata = mode ? { mode } : {};
      return group
       ? callSignaling.inviteGroup(targetRoomId, calleeIds, metadata)
        : callSignaling.invite(targetRoomId, calleeIds, metadata);
    },
    [],
  );

  const sendInviteDefault = useCallback(
    (calleeIds: number[], { group, mode }: { group?: boolean; mode?: 'audio' | 'video' } = {}) => {
      const resolvedRoomId = ensureNumber(roomId);
      if (!resolvedRoomId) {
        return Promise.reject(new Error('Room id not available'));
      }
      return sendInvite(resolvedRoomId, calleeIds, { group, mode });
    },
    [roomId, sendInvite],
  );

  const joinCall = useCallback(
    (targetCallId?: number) => {
      const resolved = targetCallId ?? ensureNumber(callId);
      if (!resolved) {
        return Promise.reject(new Error('Call id not available'));
      }
      return callSignaling.join(resolved);
    },
    [callId],
  );

  const leaveCall = useCallback(
    (targetCallId?: number) => {
      const resolved = targetCallId ?? ensureNumber(callId);
      if (!resolved) {
        return Promise.reject(new Error('Call id not available'));
      }
      return callSignaling.leave(resolved);
    },
    [callId],
  );

  const markRinging = useCallback(
    (targetCallId?: number) => {
      const resolved = targetCallId ?? ensureNumber(callId);
      if (!resolved) {
        return Promise.reject(new Error('Call id not available'));
      }
      return callSignaling.ringing(resolved);
    },
    [callId],
  );

  const sendOffer = useCallback(
    (payload: CallOfferPayload, targetCallId?: number) => {
      const resolved = targetCallId ?? ensureNumber(callId);
      if (!resolved) {
        return Promise.reject(new Error('Call id not available'));
      }
      return callSignaling.offer(resolved, payload);
    },
    [callId],
  );

  const answerCall = useCallback(
    (payloadOrCallId?: CallAnswerPayload | number, targetCallId?: number) => {
      const hasPayload =
        payloadOrCallId != null && typeof payloadOrCallId === 'object' && 'type' in payloadOrCallId;
      const payload = hasPayload ? (payloadOrCallId as CallAnswerPayload) : ({ type: 'answer' } as CallAnswerPayload);
      const resolved = hasPayload
        ? targetCallId ?? ensureNumber(callId)
        : ensureNumber(payloadOrCallId as number | null | undefined) ?? ensureNumber(callId);
      if (!resolved) {
        return Promise.reject(new Error('Call id not available'));
      }
      return callSignaling.answer(resolved, payload);
    },
    [callId],
  );

  const declineCall = useCallback(
    (targetCallId?: number) => {
      const resolved = targetCallId ?? ensureNumber(callId);
      if (!resolved) {
        return Promise.reject(new Error('Call id not available'));
      }
      return callSignaling.decline(resolved);
    },
    [callId],
  );

  const endCall = useCallback(
    (targetCallId?: number) => {
      const resolved = targetCallId ?? ensureNumber(callId);
      if (!resolved) {
        return Promise.reject(new Error('Call id not available'));
      }
      return callSignaling.end(resolved);
    },
    [callId],
  );

  const sendCandidate = useCallback(
    (payload: CallCandidatePayload, targetCallId?: number) => {
      const resolved = targetCallId ?? ensureNumber(callId);
      if (!resolved) {
        return Promise.reject(new Error('Call id not available'));
      }
      return callSignaling.candidate(resolved, payload);
    },
    [callId],
  );

  const requestReinvite = useCallback(
    (targetCallId?: number) => {
      const resolved = targetCallId ?? ensureNumber(callId);
      if (!resolved) {
        return Promise.reject(new Error('Call id not available'));
      }
      return callSignaling.reinvite(resolved);
    },
    [callId],
  );

  const reportFailure = useCallback(
    (targetCallId?: number) => {
      const resolved = targetCallId ?? ensureNumber(callId);
      if (!resolved) {
        return Promise.reject(new Error('Call id not available'));
      }
      return callSignaling.fail(resolved);
    },
    [callId],
  );

  return {
    sendInvite,
    sendInviteDefault,
    joinCall,
    leaveCall,
    markRinging,
    sendOffer,
    answerCall,
    declineCall,
    endCall,
    sendCandidate,
    requestReinvite,
    reportFailure,
  } as const;
};

export default useCallSignaling;