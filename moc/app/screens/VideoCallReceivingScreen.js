import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

  const { declineCall } = useCallSignalingHook({ callId });

  const handleDecline = async () => {
    try {
      if (callId) {
        await declineCall(callId);
      }
    } catch (err) {
      console.warn('Failed to decline video call', err);
    } finally {
      router.back();
    }
  };

  const handleAccept = () => {
    if (!callId) {
      Alert.alert('Call unavailable', 'Unable to open this incoming call.');
      return;
    }
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
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>Incoming video call</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          {image ? (
            <Image source={{ uri: image }} style={styles.avatarImage} />
          ) : (
            <Icon name="person" size={80} color="#7a7a7a" />
          )}
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.status}>Wants to start a video call…</Text>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={[styles.controlBtn, styles.decline]} onPress={handleDecline}>
          <Icon name="call-end" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlBtn, styles.accept]} onPress={handleAccept}>
          <Icon name="videocam" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 4,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    marginBottom: 18,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  status: {
    marginTop: 6,
    fontSize: 16,
    color: '#CBD5E1',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  controlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  decline: {
    backgroundColor: '#E53935',
  },
  accept: {
    backgroundColor: '#16A34A',
  },
});