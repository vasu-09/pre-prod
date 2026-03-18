import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import useCallSignalingHook from '../hooks/useCallSignaling';

export default function VideoCallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const pickParam = value => (Array.isArray(value) ? value[0] : value);

  const name = pickParam(params?.name) ?? 'Unknown';
  const callIdRaw = pickParam(params?.callId);
  const role = pickParam(params?.role) ?? 'caller';
  const callId = callIdRaw != null ? Number(callIdRaw) : null;

  const [videoEnabled, setVideoEnabled] = useState(true);
  const [permission, requestPermission] = useCameraPermissions();
  const [statusText, setStatusText] = useState(
    role === 'callee' ? 'Connecting…' : 'Calling…',
  );
  const hasEndedRef = useRef(false);
  const joinedCallRef = useRef(null);

  const handleCallEvent = useCallback(
    event => {
      if (!event) {
        return;
      }

      const eventCallId =
        typeof event.callId === 'number' ? event.callId : Number(event.callId ?? callId);

      if (callId && !Number.isNaN(eventCallId) && eventCallId !== callId) {
        return;
      }

      switch (event.type) {
        case 'call.ringing':
          if (role === 'caller') {
            setStatusText('Ringing…');
          }
          break;
        case 'call.answer':
        case 'call.join':
          setStatusText('Connected');
          break;
        case 'call.decline':
          if (!hasEndedRef.current) {
            hasEndedRef.current = true;
            Alert.alert('Call declined', 'The other participant declined the call.');
            router.back();
          }
          break;
        case 'call.end':
        case 'call.fail':
          if (!hasEndedRef.current) {
            hasEndedRef.current = true;
            router.back();
          }
          break;
        default:
          break;
      }
    },
    [callId, role, router],
  );

  const { joinCall, leaveCall, endCall } = useCallSignalingHook({
    callId,
    onCallEvent: handleCallEvent,
  });

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    };
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!callId || Number.isNaN(callId) || joinedCallRef.current === callId) {
      return;
    }

    joinedCallRef.current = callId;
    hasEndedRef.current = false;

    if (role === 'callee') {
      setStatusText('Connecting…');
    }

    joinCall(callId).catch(err => console.warn('Failed to join video call', err));

    return () => {
      if (joinedCallRef.current === callId) {
        joinedCallRef.current = null;
      }
      leaveCall(callId).catch(err => console.warn('Failed to leave video call', err));
    };
  }, [callId, joinCall, leaveCall, role]);


  const handleEnd = useCallback(async () => {
    try {
      if (callId && !Number.isNaN(callId)) {
        hasEndedRef.current = true;
        await endCall(callId);
      }
    } catch (err) {
      console.warn('Failed to end video call', err);
    } finally {
      router.back();
    }
  }, [callId, endCall, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.cameraContainer}>
        {videoEnabled && permission?.granted ? (
          <CameraView style={StyleSheet.absoluteFill} facing="front" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <Icon name="videocam-off" size={100} color="#1f6ea7" />
          </View>
        )}

        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={handleEnd} style={styles.backBtn}>
            <Icon name="arrow-back" size={28} color="#1f6ea7" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>{name}</Text>
            <Text style={styles.headerSubtitle}>{statusText}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.controlBtn}>
          <Icon name="mic-off" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={() => setVideoEnabled(v => !v)}>
          <Icon name={videoEnabled ? 'videocam' : 'videocam-off'} size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn}>
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
    backgroundColor: '#E5F4FF',
  },
  cameraContainer: {
    flex: 8,
    backgroundColor: '#000',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5F4FF',
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
    flex: 1,
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
    backgroundColor: '#E5F4FF',
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1f6ea7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCall: {
    backgroundColor: '#E53935',
  },
});