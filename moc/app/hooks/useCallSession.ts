import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MediaStream, RTCPeerConnection } from 'react-native-webrtc';

import apiClient from '../services/apiClient';
import { CallCandidatePayload, CallSignalEvent, TurnCredentials } from '../services/callSignaling';
import {
    addLocalTracks,
    addRemoteCandidate,
    applyRemoteAnswer,
    applyRemoteOffer,
    createLocalStream,
    createPeer,
    disposePeer,
    makeAnswer,
    makeOffer,
    normalizeTurnCredentials,
} from '../services/webrtcService';
import { useCallSignaling as useCallSignalingHook } from './useCallSignaling';

export type CallSessionState =
  | 'idle'
  | 'outgoing_invite'
  | 'incoming_invite'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ended'
  | 'failed';

type UseCallSessionArgs = {
  roomId?: number;
  callId?: number | null;
  isVideo?: boolean;
  isCallee?: boolean;
  onIncomingInvite?: (event: CallSignalEvent) => void;
};

const isCandidateEvent = (event: CallSignalEvent) => {
  const type = event?.type ?? event?.event;
  return type === 'call.candidate' || Boolean(event?.candidate);
};

export const useCallSession = ({
  roomId,
  callId,
  isVideo = false,
  isCallee = false,
  onIncomingInvite,
}: UseCallSessionArgs) => {
  const [state, setState] = useState<CallSessionState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [turnCredentials, setTurnCredentials] = useState<TurnCredentials | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callEventHandlerRef = useRef<(event: CallSignalEvent) => void>(() => {});

  const {
    joinCall,
    markRinging,
    leaveCall,
    sendOffer,
    answerCall,
    sendCandidate,
  } = useCallSignalingHook({
    roomId,
    callId: callId ?? undefined,
    onCallEvent: event => callEventHandlerRef.current(event),
    onBufferedCallEvent: event => callEventHandlerRef.current(event),
    onTurnCredentials: credentials => setTurnCredentials(credentials),
  });

  const ensureTurnCredentials = useCallback(async () => {
    if (turnCredentials) {
      return turnCredentials;
    }
    const response = await apiClient.get('/api/calls/turn');
    const creds = response?.data ?? null;
    setTurnCredentials(creds);
    return creds;
  }, [turnCredentials]);

  const ensurePeer = useCallback(async () => {
    if (pcRef.current) {
      return pcRef.current;
    }

    const creds = await ensureTurnCredentials();
    const pc = createPeer({
      iceServers: normalizeTurnCredentials(creds),
      onRemoteStream: stream => setRemoteStream(stream),
      onIceCandidate: async candidate => {
        if (!callId) {
          return;
        }
        await sendCandidate(candidate, callId);
      },
      onConnectionStateChange: connectionState => {
        if (connectionState === 'connected') {
          setState('connected');
        } else if (connectionState === 'failed') {
          setState('failed');
        } else if (connectionState === 'disconnected') {
          setState('reconnecting');
        }
      },
    });

    const stream = await createLocalStream(isVideo);
    await addLocalTracks(pc, stream);

    setLocalStream(stream);
    pcRef.current = pc;
    return pc;
  }, [callId, ensureTurnCredentials, isVideo, sendCandidate]);

  const handleCallEvent = useCallback(
    async (event: CallSignalEvent) => {
      if (!event) {
        return;
      }

      const eventType = event.type ?? event.event;
      if (eventType === 'call.invite') {
        onIncomingInvite?.(event);
        setState('incoming_invite');
        return;
      }

      if (eventType === 'call.ringing') {
        setState('ringing');
        return;
      }

      if (eventType === 'call.offer' && event?.sdp) {
        const pc = await ensurePeer();
        await applyRemoteOffer(pc, event.sdp);
        const answer = await makeAnswer(pc);
        if (callId && answer.sdp) {
          await answerCall({ type: 'answer', sdp: answer.sdp }, callId);
          setState('connecting');
        }
        return;
      }

      if (eventType === 'call.answer' && event?.sdp) {
        const pc = await ensurePeer();
        await applyRemoteAnswer(pc, event.sdp);
        setState('connecting');
        return;
      }

      if (isCandidateEvent(event) && event?.candidate) {
        if (pcRef.current) {
          await addRemoteCandidate(pcRef.current, event as CallCandidatePayload);
        }
        return;
      }

      if (eventType === 'call.end') {
        setState('ended');
      }

      if (eventType === 'call.fail') {
        setState('failed');
      }
    },
    [answerCall, callId, ensurePeer, onIncomingInvite],
  );

  useEffect(() => {
    callEventHandlerRef.current = event => {
      handleCallEvent(event).catch(err => {
        console.warn('Failed to process call event', err);
      });
    };
  }, [handleCallEvent]);

  const startOutgoing = useCallback(async () => {
    if (!callId) {
      throw new Error('callId is required to start call session');
    }
    setState('outgoing_invite');
    const pc = await ensurePeer();
    await joinCall(callId);
    const offer = await makeOffer(pc);
    if (offer.sdp) {
      await sendOffer({ type: 'offer', sdp: offer.sdp }, callId);
    }
    setState('connecting');
  }, [callId, ensurePeer, joinCall, sendOffer]);

  const acceptIncoming = useCallback(async () => {
    if (!callId) {
      throw new Error('callId is required to accept call session');
    }
    await ensurePeer();
    await joinCall(callId);
    if (isCallee) {
      await markRinging(callId);
    }
    setState('connecting');
  }, [callId, ensurePeer, isCallee, joinCall, markRinging]);

  const endSession = useCallback(async () => {
    if (callId) {
      await leaveCall(callId);
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
    disposePeer(pcRef.current);
    pcRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setState('ended');
  }, [callId, leaveCall, localStream, remoteStream]);

  useEffect(() => {
    return () => {
      disposePeer(pcRef.current);
      pcRef.current = null;
    };
  }, []);

  return useMemo(
    () => ({
      state,
      localStream,
      remoteStream,
      turnCredentials,
      ensureTurnCredentials,
      startOutgoing,
      acceptIncoming,
      endSession,
    }),
    [
      acceptIncoming,
      endSession,
      ensureTurnCredentials,
      localStream,
      remoteStream,
      startOutgoing,
      state,
      turnCredentials,
    ],
  );
};

export default useCallSession;