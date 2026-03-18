import { useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import useCallSession from '../hooks/useCallSession';

const formatDuration = totalSeconds => {
  const safeSeconds = Math.max(0, totalSeconds || 0);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(safeSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const getStatusText = (sessionState, role) => {
  switch (sessionState) {
    case 'outgoing_invite':
      return 'Calling…';
    case 'incoming_invite':
      return 'Incoming video call…';
    case 'ringing':
      return role === 'caller' ? 'Ringing…' : 'Connecting…';
    case 'connecting':
      return 'Connecting…';
    case 'connected':
      return 'Connected';
    case 'reconnecting':
      return 'Reconnecting…';
    case 'failed':
      return 'Video call failed';
    case 'ended':
      return 'Call ended';
    case 'idle':
    default:
      return role === 'callee' ? 'Connecting…' : 'Calling…';
  }
};

export default function VideoCallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const pickParam = value => (Array.isArray(value) ? value[0] : value);

  const name = pickParam(params?.name) ?? 'Unknown';
  const image = pickParam(params?.image);
  const callIdRaw = pickParam(params?.callId);
  const role = pickParam(params?.role) ?? 'caller';
  const callId = callIdRaw != null ? Number(callIdRaw) : null;

  const [permission, requestPermission] = useCameraPermissions();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const connectedAtRef = useRef(null);
  const startHandledRef = useRef(false);
  const closingRef = useRef(false);

  const {
    state: sessionState,
    localStream,
    remoteStream,
    startOutgoing,
    acceptIncoming,
    endSession,
    toggleMute,
    toggleVideo,
    isMuted,
    isVideoEnabled,
  } = useCallSession({
    callId,
    isVideo: true,
    isCallee: role === 'callee',
  });

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!callId || Number.isNaN(callId) || startHandledRef.current || !permission?.granted) {
      return;
    }

    startHandledRef.current = true;
    const action = role === 'callee' ? acceptIncoming : startOutgoing;

    action().catch(err => {
      console.warn('Failed to initialize video call session', err);
      Alert.alert('Call error', 'Unable to start this video call.');
      router.back();
    });
  }, [acceptIncoming, callId, permission, role, router, startOutgoing]);

  useEffect(() => {
    if (sessionState === 'connected' && !connectedAtRef.current) {
      connectedAtRef.current = Date.now();
      return;
    }

    if (sessionState !== 'connected') {
      connectedAtRef.current = null;
      setElapsedSeconds(0);
    }
  }, [sessionState]);

  useEffect(() => {
    if (sessionState !== 'connected' || !connectedAtRef.current) {
      return;
    }

    const intervalId = setInterval(() => {
      if (!connectedAtRef.current) {
        return;
      }
      setElapsedSeconds(Math.floor((Date.now() - connectedAtRef.current) / 1000));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [sessionState]);

  useEffect(() => {
    if ((sessionState === 'ended' || sessionState === 'failed') && !closingRef.current) {
      const timeoutId = setTimeout(() => {
        router.back();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [router, sessionState]);

  const statusText = useMemo(() => getStatusText(sessionState, role), [role, sessionState]);

  const handleEnd = async () => {
    closingRef.current = true;
    try {
      await endSession();
    } catch (err) {
      console.warn('Failed to end video call', err);
    } finally {
      router.back();
    }
  };

  const remoteStreamUrl = remoteStream?.toURL?.();
  const localStreamUrl = localStream?.toURL?.();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.cameraContainer}>
        {remoteStreamUrl ? (
          <RTCView streamURL={remoteStreamUrl} style={styles.remoteVideo} objectFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.remotePlaceholder]}>
            {image ? (
              <Image source={{ uri: image }} style={styles.remotePlaceholderImage} />
            ) : (
              <Icon name="person" size={96} color="#FFFFFF" />
            )}
            <Text style={styles.waitingName}>{name}</Text>
            <Text style={styles.waitingText}>
              {permission?.granted ? statusText : 'Waiting for camera permission…'}
            </Text>
          </View>
        )}

        {localStreamUrl && isVideoEnabled ? (
          <RTCView
            streamURL={localStreamUrl}
            style={styles.localPreview}
            objectFit="cover"
            mirror
          />
        ) : (
          <View style={styles.localPreviewPlaceholder}>
            <Icon name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={26} color="#fff" />
          </View>
        )}

        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={handleEnd} style={styles.backBtn}>
            <Icon name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>{name}</Text>
            <Text style={styles.headerSubtitle}>
              {sessionState === 'connected' ? formatDuration(elapsedSeconds) : statusText}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.controlBtn} onPress={toggleMute}>
          <Icon name={isMuted ? 'mic-off' : 'mic'} size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={toggleVideo}>
          <Icon name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlBtn, styles.disabledControlBtn]} activeOpacity={0.8}>
          <Icon name="volume-up" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlBtn, styles.endCall]} onPress={handleEnd}>
          <Icon name="call-end" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#05070A',
  },
  cameraContainer: {
    flex: 8,
    backgroundColor: '#000',
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  remotePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    gap: 12,
  },
  remotePlaceholderImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  waitingName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  waitingText: {
    fontSize: 15,
    color: '#CBD5E1',
  },
  localPreview: {
    position: 'absolute',
    right: 16,
    top: 90,
    width: 120,
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  localPreviewPlaceholder: {
    position: 'absolute',
    right: 16,
    top: 90,
    width: 120,
    height: 180,
    borderRadius: 18,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backBtn: {
    padding: 4,
  },
  headerTextWrap: {
    flex: 1,
    marginRight: 28,
  },
  headerTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    marginTop: 2,
    textAlign: 'center',
    fontSize: 14,
    color: '#E2E8F0',
  },
  controls: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#05070A',
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1f6ea7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledControlBtn: {
    opacity: 0.65,
  },
  endCall: {
    backgroundColor: '#E53935',
  },
});
