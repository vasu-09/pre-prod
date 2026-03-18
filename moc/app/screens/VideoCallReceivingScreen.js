import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
// eslint-disable-next-line import/no-unresolved
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import useCallSignalingHook from '../hooks/useCallSignaling';

export default function VideoCallReceivingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const pickParam = value => (Array.isArray(value) ? value[0] : value);

  const name = pickParam(params?.name) ?? 'Unknown caller';
  const image = pickParam(params?.image);
  const callIdRaw = pickParam(params?.callId);

  const callId = useMemo(() => {
    if (callIdRaw == null) return null;
    const parsed = Number(callIdRaw);
    return Number.isNaN(parsed) ? null : parsed;
  }, [callIdRaw]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const closedRef = useRef(false);

  const handleIncomingEvent = useCallback(
    event => {
      if (!event || closedRef.current) return;

      const eventCallId =
        typeof event.callId === 'number' ? event.callId : Number(event.callId ?? callId);

      if (callId && !Number.isNaN(eventCallId) && eventCallId !== callId) {
        return;
      }

      switch (event.type ?? event.event) {
        case 'call.end':
        case 'call.fail':
        case 'call.decline':
          closedRef.current = true;
          router.back();
          break;
        default:
          break;
      }
    },
    [callId, router],
  );

  const { declineCall, markRinging } = useCallSignalingHook({
    callId,
    onCallEvent: handleIncomingEvent,
  });

  useEffect(() => {
    if (!callId) {
      return;
    }

    markRinging(callId).catch(err => {
      console.warn('Failed to mark video call as ringing', err);
    });
  }, [callId, markRinging]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 900,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const handleDecline = async () => {
    try {
      if (callId) {
        await declineCall(callId);
      }
    } catch (err) {
      console.warn('Failed to decline video call', err);
    } finally {
      closedRef.current = true;
      router.back();
    }
  };

  const handleAccept = () => {
    if (!callId) {
      Alert.alert('Call unavailable', 'Unable to open this incoming call.');
      return;
    }

    closedRef.current = true;

    router.replace({
      pathname: '/screens/VideoCallScreen',
      params: {
        callId: String(callId),
        name,
        ...(image ? { image } : {}),
        role: 'callee',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#05070A', '#0B0F14', '#111827']}
        style={styles.container}
      >
        <View style={[styles.topArea, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.callType}>Incoming video call</Text>
        </View>

        <View style={styles.centerArea}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />

          <View style={styles.avatarContainer}>
            {image ? (
              <Image source={{ uri: image }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {name?.trim()?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>

          <Text numberOfLines={1} style={styles.name}>
            {name}
          </Text>

          <Text style={styles.status}>is calling you…</Text>
        </View>
        <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 22 }]}>
          <View style={styles.controlsRow}>
            <View style={styles.controlItem}>
              <Pressable
                style={[styles.actionBtn, styles.declineBtn]}
                onPress={handleDecline}
              >
                <Icon name="call-end" size={28} color="#fff" />
              </Pressable>
              <Text style={styles.actionLabel}>Decline</Text>
            </View>

            <View style={styles.controlItem}>
              <Pressable
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={handleAccept}
              >
                <Icon name="videocam" size={28} color="#fff" />
              </Pressable>
              <Text style={styles.actionLabel}>Accept</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#05070A',
  },

  container: {
    flex: 1,
  },

  topArea: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  callType: {
    color: '#D1D5DB',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  pulseRing: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  avatarContainer: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#1F2937',
    marginBottom: 22,
  },

  avatarImage: {
    width: '100%',
    height: '100%',
  },

  avatarFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarFallbackText: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '700',
  },

  name: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },

  status: {
    marginTop: 8,
    color: '#9CA3AF',
    fontSize: 16,
    textAlign: 'center',
  },

  bottomArea: {
    paddingHorizontal: 28,
  },

  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },

  controlItem: {
    alignItems: 'center',
  },

  actionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  declineBtn: {
    backgroundColor: '#E53935',
  },

  acceptBtn: {
    backgroundColor: '#16A34A',
  },

  actionLabel: {
    marginTop: 10,
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '500',
  },
});