import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import useCallSession from '../hooks/useCallSession';

function GradientCircle({ style }) {
  return <View style={[style, { backgroundColor: '#a6d0ecff' }]} />;
}

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
      return 'Incoming call…';
    case 'ringing':
      return role === 'caller' ? 'Ringing…' : 'Connecting…';
    case 'connecting':
      return 'Connecting…';
    case 'connected':
      return 'Connected';
    case 'reconnecting':
      return 'Reconnecting…';
    case 'failed':
      return 'Call failed';
    case 'ended':
      return 'Call ended';
    case 'idle':
    default:
      return role === 'callee' ? 'Connecting…' : 'Calling…';
  }
};

export default function CallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const pickParam = value => {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  };

  const name = pickParam(params?.name) ?? 'Harika';
  const image = pickParam(params?.image);
  const callIdRaw = pickParam(params?.callId);
  const role = pickParam(params?.role) ?? 'caller';

  const parsedCallId = callIdRaw != null ? Number(callIdRaw) : null;
  const callId = parsedCallId != null && !Number.isNaN(parsedCallId) ? parsedCallId : null;

  const {
    state: sessionState,
    remoteStream,
    startOutgoing,
    acceptIncoming,
    endSession,
    toggleMute,
    isMuted,
  } = useCallSession({
    callId,
    isVideo: false,
    isCallee: role === 'callee',
  });

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const connectedAtRef = useRef(null);
  const startHandledRef = useRef(false);
  const closingRef = useRef(false);
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!callId || startHandledRef.current) {
      return;
    }

    startHandledRef.current = true;
    const action = role === 'callee' ? acceptIncoming : startOutgoing;

    action().catch(err => {
      console.warn('Failed to initialize audio call session', err);
      Alert.alert('Call error', 'Unable to start this audio call.');
      router.back();
    });
  }, [acceptIncoming, callId, role, router, startOutgoing]);

  useEffect(() => {
    const animate = (anim, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ).start();

    animate(wave1);
    animate(wave2, 1000);
  }, [wave1, wave2]);

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
  const scale1 = wave1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const opacity1 = wave1.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });
  const scale2 = wave2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const opacity2 = wave2.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });

  const handleEnd = async () => {
    closingRef.current = true;
    try {
      await endSession();
    } catch (err) {
      console.warn('Failed to end audio call', err);
    } finally {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={handleEnd} style={styles.backBtn}>
          <Icon name="arrow-back" size={28} color="#1f6ea7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{name}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.avatarWrapper}>
          <Animated.View
            style={[styles.wave, { transform: [{ scale: scale1 }], opacity: opacity1 }]}
          >
            <GradientCircle style={styles.waveGradient} />
          </Animated.View>
          <Animated.View
            style={[styles.wave, { transform: [{ scale: scale2 }], opacity: opacity2 }]}
          >
            <GradientCircle style={styles.waveGradient} />
          </Animated.View>
          <View style={styles.avatarContainer}>
            {image ? (
              <Image source={{ uri: image }} style={styles.avatarImage} />
            ) : (
              <Icon name="person" size={80} color="#7a7a7a" />
            )}
          </View>
        </View>

        <Text style={styles.statusText}>{statusText}</Text>
        <Text style={styles.subStatusText}>
          {sessionState === 'connected'
            ? formatDuration(elapsedSeconds)
            : remoteStream
              ? 'Voice channel ready'
              : role === 'caller'
                ? 'Waiting for answer'
                : 'Joining call'}
        </Text>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={styles.controlBtn} onPress={toggleMute}>
          <Icon name={isMuted ? 'mic-off' : 'mic'} size={28} color="#fff" />
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
    backgroundColor: '#E5F4FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginRight: 28,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 180,
    height: 180,
    marginBottom: 24,
  },
  wave: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  waveGradient: {
    flex: 1,
    borderRadius: 90,
  },
  avatarContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 4,
    borderColor: '#7EC1DE',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#e6e6e6',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  statusText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
  },
  subStatusText: {
    marginTop: 8,
    fontSize: 15,
    color: '#555',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 32,
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
