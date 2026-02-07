import { useCallback, useEffect } from 'react';

import callSignaling, { CallSignalEvent, TurnCredentials } from '../services/callSignaling';

export type UseCallSignalingOptions = {
  roomId?: number | null;
  callId?: number | null;
  onRoomEvent?: (event: CallSignalEvent) => void;
  onCallEvent?: (event: CallSignalEvent) => void;
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
  const { roomId, callId, onRoomEvent, onCallEvent, onQueueEvent, onTurnCredentials } = options;

  useEffect(() => {
    if (!roomId || !onRoomEvent) {
      return;
    }
    return callSignaling.subscribeRoom(roomId, onRoomEvent);
  }, [roomId, onRoomEvent]);

  useEffect(() => {
    if (!callId || !onCallEvent) {
      return;
    }
    return callSignaling.subscribeCall(callId, onCallEvent);
  }, [callId, onCallEvent]);

  useEffect(() => {
    if (!onQueueEvent) {
      return;
    }
    const unsubscribe = callSignaling.subscribeQueue(onQueueEvent);
    return () => unsubscribe();
  }, [onQueueEvent]);

  useEffect(() => {
    if (!onTurnCredentials) {
      return;
    }
    const unsubscribe = callSignaling.subscribeTurn(onTurnCredentials);
    return () => unsubscribe();
  }, [onTurnCredentials]);

  const sendInvite = useCallback(
    (targetRoomId: number, calleeIds: number[], { group }: { group?: boolean } = {}) => {
      if (!targetRoomId || !Array.isArray(calleeIds) || !calleeIds.length) {
        return Promise.reject(new Error('A valid room id and at least one callee are required'));
      }
      return group
        ? callSignaling.inviteGroup(targetRoomId, calleeIds)
        : callSignaling.invite(targetRoomId, calleeIds);
    },
    [],
  );

  const sendInviteDefault = useCallback(
    (calleeIds: number[], { group }: { group?: boolean } = {}) => {
      const resolvedRoomId = ensureNumber(roomId);
      if (!resolvedRoomId) {
        return Promise.reject(new Error('Room id not available'));
      }
      return sendInvite(resolvedRoomId, calleeIds, { group });
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

  const answerCall = useCallback(
    (sdp: string, targetCallId?: number) => {
      const resolved = targetCallId ?? ensureNumber(callId);
      if (!resolved) {
        return Promise.reject(new Error('Call id not available'));
      }
      return callSignaling.answer(resolved, sdp);
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
    (candidate: string, targetCallId?: number) => {
      const resolved = targetCallId ?? ensureNumber(callId);
      if (!resolved) {
        return Promise.reject(new Error('Call id not available'));
      }
      return callSignaling.candidate(resolved, candidate);
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
    answerCall,
    declineCall,
    endCall,
    sendCandidate,
    requestReinvite,
    reportFailure,
  } as const;
};

export default useCallSignaling;