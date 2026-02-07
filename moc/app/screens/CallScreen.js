import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import useCallSignalingHook from '../hooks/useCallSignaling';

// Fallback replacement for LinearGradient to avoid requiring an extra
// dependency. It simply renders a solid color view that matches the
// previous gradient's starting color.
function GradientCircle({ style }) {
  return <View style={[style, { backgroundColor: '#a6d0ecff' }]} />;
}

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
  const [statusText, setStatusText] = useState(
    role === 'callee' ? 'Incoming call…' : 'Calling…',
  );
  const hasEndedRef = useRef(false);

  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;

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
            setStatusText('Declined');
            Alert.alert('Call declined', 'The other participant declined the call.');
            router.back();
          }
          break;
        case 'call.end':
          if (!hasEndedRef.current) {
            hasEndedRef.current = true;
            setStatusText('Call ended');
            router.back();
          }
          break;
        case 'call.fail':
          if (!hasEndedRef.current) {
            hasEndedRef.current = true;
            setStatusText('Call failed');
            Alert.alert('Call failed', 'The call ended unexpectedly.');
            router.back();
          }
          break;
        default:
          break;
      }
    },
    [callId, role, router],
  );

  const { joinCall, leaveCall, endCall: signalEndCall, markRinging } = useCallSignalingHook({
    callId,
    onCallEvent: handleCallEvent,
  });

  useEffect(() => {
    if (!callId) {
      return;
    }
    hasEndedRef.current = false;
    joinCall().catch(err => console.warn('Failed to join call', err));
    if (role === 'callee') {
      markRinging().catch(err => console.warn('Failed to signal ringing state', err));
    }
    return () => {
      leaveCall().catch(err => console.warn('Failed to leave call', err));
    };
  }, [callId, joinCall, leaveCall, markRinging, role]);

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

  const scale1 = wave1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const opacity1 = wave1.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });
  const scale2 = wave2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const opacity2 = wave2.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={async () => {
            if (callId) {
              try {
                hasEndedRef.current = true;
                setStatusText('Call ended');
                await signalEndCall();
              } catch (err) {
                console.warn('Failed to end call', err);
              }
            }
            router.back();
          }}
          style={styles.backBtn}
        >
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
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={styles.controlBtn}>
          <Icon name="mic-off" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn}>
          <Icon name="volume-up" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlBtn, styles.endCall]}
          onPress={async () => {
            if (callId) {
              try {
                hasEndedRef.current = true;
                setStatusText('Call ended');
                await signalEndCall();
              } catch (err) {
                console.warn('Failed to end call', err);
              }
            }
            router.back();
          }}
        >
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
    marginRight: 28, // to offset back button width for centering
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
    fontSize: 18,
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
  endCall: {
    backgroundColor: '#E53935',
  },
});