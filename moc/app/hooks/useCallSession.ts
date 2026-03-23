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
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideo);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callEventHandlerRef = useRef<(event: CallSignalEvent) => void>(() => {});
  const offerStartedRef = useRef(false);

  const {
    joinCall,
    leaveCall,
    sendOffer,
    answerCall,
    sendCandidate,
    endCall,
  } = useCallSignalingHook({
    roomId,
    callId: callId ?? undefined,
    onCallEvent: event => callEventHandlerRef.current(event),
    onBufferedCallEvent: event => callEventHandlerRef.current(event),
    onTurnCredentials: credentials => setTurnCredentials(credentials),
  });

  const cleanupSessionResources = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // ignore track cleanup failure
        }
      });
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // ignore track cleanup failure
        }
      });
    }

    disposePeer(pcRef.current);
    pcRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoEnabled(isVideo);
  }, [isVideo, localStream, remoteStream]);

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
        if (connectionState === 'connecting') {
          setState(prev => (prev === 'connected' ? prev : 'connecting'));
          return;
        }
        if (connectionState === 'connected') {
          setState('connected');
          return;
        }
        if (connectionState === 'failed') {
          setState('failed');
          return;
        }
        if (connectionState === 'disconnected') {
          setState('reconnecting');
          return;
        }
        if (connectionState === 'closed') {
          setState('ended');
        }
      },
    });

    const stream = await createLocalStream(isVideo);
    await addLocalTracks(pc, stream);

    setLocalStream(stream);
    setIsMuted(false);
    setIsVideoEnabled(isVideo);
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
        setState(prev => (prev === 'connected' ? prev : 'ringing'));
        return;
      }

      if (eventType === 'call.join') {
        if (!isCallee && !offerStartedRef.current) {
          offerStartedRef.current = true;
          const pc = await ensurePeer();
          const offer = await makeOffer(pc);
          if (callId && offer.sdp) {
            await sendOffer({ type: 'offer', sdp: offer.sdp }, callId);
          }
        }
        setState(prev => (prev === 'connected' ? prev : 'connecting'));
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

      if (eventType === 'call.decline' || eventType === 'call.end') {
        cleanupSessionResources();
        setState('ended');
        return;
      }

      if (eventType === 'call.fail') {
        cleanupSessionResources();
        setState('failed');
      }
    },
    [answerCall, callId, cleanupSessionResources, ensurePeer, isCallee, onIncomingInvite, sendOffer],
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

    offerStartedRef.current = false;
    setState('outgoing_invite');
  }, [callId]);

  const acceptIncoming = useCallback(async () => {
    if (!callId) {
      throw new Error('callId is required to accept call session');
    }

    await ensurePeer();
    await joinCall(callId);
    setState('connecting');
  }, [callId, ensurePeer, joinCall]);


  const toggleMute = useCallback(() => {
    if (!localStream) {
      return;
    }

    const nextMuted = !isMuted;
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }, [isMuted, localStream]);

  const toggleVideo = useCallback(() => {
    if (!isVideo || !localStream) {
      return;
    }

    const nextEnabled = !isVideoEnabled;
    localStream.getVideoTracks().forEach(track => {
      track.enabled = nextEnabled;
    });
    setIsVideoEnabled(nextEnabled);
  }, [isVideo, isVideoEnabled, localStream]);

  const endSession = useCallback(async () => {
    try {
      if (callId) {
        await endCall(callId);
      }
    } finally {
      cleanupSessionResources();
      setState('ended');
    }
  }, [callId, cleanupSessionResources, endCall]);

  const disposeSession = useCallback(async () => {
    try {
      if (callId) {
        await leaveCall(callId);
      }
    } catch (err) {
      console.warn('Failed to leave call session cleanly', err);
    } finally {
      cleanupSessionResources();
    }
  }, [callId, cleanupSessionResources, leaveCall]);

  useEffect(() => {
    return () => {
      disposeSession().catch(err => {
        console.warn('Failed to dispose call session', err);
      });
    };
  }, [disposeSession]);

  return useMemo(
    () => ({
      state,
      localStream,
      remoteStream,
      turnCredentials,
      isMuted,
      isVideoEnabled,
      ensureTurnCredentials,
      startOutgoing,
      acceptIncoming,
      endSession,
      disposeSession,
      toggleMute,
      toggleVideo,
    }),
    [
      acceptIncoming,
      disposeSession,
      endSession,
      ensureTurnCredentials,
      isMuted,
      isVideoEnabled,
      localStream,
      remoteStream,
      startOutgoing,
      state,
      toggleMute,
      toggleVideo,
      turnCredentials,
    ],
  );
};

export default useCallSession;
