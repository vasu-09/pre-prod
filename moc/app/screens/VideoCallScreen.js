import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function VideoCallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { name = 'Harika' } = useLocalSearchParams();

  const [videoEnabled, setVideoEnabled] = useState(true);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission, requestPermission]);

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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Icon name="arrow-back" size={28} color="#1f6ea7" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{name}</Text>
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.controlBtn}>
          <Icon name="mic-off" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={() => setVideoEnabled(v => !v)}>
          <Icon name={videoEnabled ? "videocam" : "videocam-off"} size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn}>
          <Icon name="volume-up" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlBtn, styles.endCall]}>
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginRight: 28,
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