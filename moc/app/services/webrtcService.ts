import {
    mediaDevices,
    MediaStream,
    RTCIceCandidate,
    RTCPeerConnection,
    RTCSessionDescription,
} from 'react-native-webrtc';

import { CallCandidatePayload } from './callSignaling';


export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type PeerConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export type CreatePeerArgs = {
  iceServers: IceServerConfig[];
  onRemoteStream: (stream: MediaStream) => void;
  onIceCandidate: (candidate: CallCandidatePayload) => void;
  onConnectionStateChange?: (state: PeerConnectionState) => void;
};

export type TurnResponse = {
  username?: string;
  credential?: string;
  uris?: string[];
  urls?: string[];
};

type SessionDescriptionLike = {
  type: 'offer' | 'answer';
  sdp?: string;
};

type TrackEventLike = Event & {
  streams?: MediaStream[];
};

type IceCandidateEventLike = Event & {
  candidate?: RTCIceCandidate | null;
};

export const normalizeTurnCredentials = (
  turnPayload?: TurnResponse | null,
): IceServerConfig[] => {
  if (!turnPayload) {
    return [];
  }

  const urls = Array.isArray(turnPayload.uris)
    ? turnPayload.uris
    : Array.isArray(turnPayload.urls)
      ? turnPayload.urls
      : [];

  if (!urls.length) {
    return [];
  }

  return [
    {
      urls,
      username: turnPayload.username,
      credential: turnPayload.credential,
    },
  ];
};

export async function createLocalStream(video: boolean) {
  return mediaDevices.getUserMedia({
    audio: true,
    video: video
      ? {
          facingMode: 'user',
          frameRate: 15,
          width: 640,
          height: 360,
        }
      : false,
  });
}

export function createPeer({
  iceServers,
  onRemoteStream,
  onIceCandidate,
  onConnectionStateChange,
}: CreatePeerArgs) {
  const pc = new RTCPeerConnection({
    iceServers,
    iceCandidatePoolSize: 4,
  });

  const remoteStream = new MediaStream();

  const handleTrack = (event: Event) => {
    const e = event as TrackEventLike;
    const firstStream = e.streams?.[0];
    if (!firstStream) {
      return;
    }

    firstStream.getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });

    onRemoteStream(remoteStream);
  };

  const handleIceCandidate = (event: Event) => {
    const e = event as IceCandidateEventLike;
    if (!e.candidate) {
      return;
    }

    onIceCandidate({
      candidate: e.candidate.candidate,
      sdpMid: e.candidate.sdpMid ?? undefined,
      sdpMLineIndex: e.candidate.sdpMLineIndex ?? undefined,
      // omit usernameFragment unless your installed typings support it
    });
  };

  const handleConnectionStateChange = () => {
    onConnectionStateChange?.(pc.connectionState as PeerConnectionState);
  };

(pc as any).addEventListener('track', handleTrack);
(pc as any).addEventListener('icecandidate', handleIceCandidate);
(pc as any).addEventListener('connectionstatechange', handleConnectionStateChange);

  return pc;
}

export const addLocalTracks = async (
  pc: RTCPeerConnection,
  stream: MediaStream,
) => {
  stream.getTracks().forEach(track => {
    pc.addTrack(track, stream);
  });
};

export const makeOffer = async (
  pc: RTCPeerConnection,
): Promise<SessionDescriptionLike> => {
  const offer = await pc.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  });
  await pc.setLocalDescription(offer);
  return {
    type: 'offer',
    sdp: offer.sdp,
  };
};

export const applyRemoteOffer = async (
  pc: RTCPeerConnection,
  sdp: string,
) => {
  await pc.setRemoteDescription(
    new RTCSessionDescription({ type: 'offer', sdp }),
  );
};

export const makeAnswer = async (
  pc: RTCPeerConnection,
): Promise<SessionDescriptionLike> => {
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return {
    type: 'answer',
    sdp: answer.sdp,
  };
};

export const applyRemoteAnswer = async (
  pc: RTCPeerConnection,
  sdp: string,
) => {
  await pc.setRemoteDescription(
    new RTCSessionDescription({ type: 'answer', sdp }),
  );
};

export const addRemoteCandidate = async (
  pc: RTCPeerConnection,
  payload: CallCandidatePayload,
) => {
  await pc.addIceCandidate(
    new RTCIceCandidate({
      candidate: payload.candidate,
      sdpMid: payload.sdpMid ?? undefined,
      sdpMLineIndex: payload.sdpMLineIndex ?? undefined,
    }),
  );
};

export const disposePeer = (pc?: RTCPeerConnection | null) => {
  if (!pc) {
    return;
  }

  pc.getSenders().forEach(sender => {
    try {
      sender.track?.stop();
    } catch {
      // ignore cleanup failure
    }
  });

  pc.close();
};