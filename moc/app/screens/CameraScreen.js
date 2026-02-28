// screens/CameraScreen.js
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const CamType = { back: 'back', front: 'front' };
const CamFlash = { off: 'off', on: 'on', auto: 'auto', torch: 'torch' };

function CameraScreen() {
  const router = useRouter();
  const { returnTo, chatReturnTo, roomId, roomKey, title, peerId, image, phone } = useLocalSearchParams();

  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);

  // Permissions
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [medPerm, requestMedPerm] = MediaLibrary.usePermissions();

  // Camera state
  const [type, setType] = useState(CamType.back);
  const [flash, setFlash] = useState(CamFlash.off);

  // Media strip
  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const onSelect = useCallback(
  (uris) => {
      const selected = Array.isArray(uris) ? uris.filter(Boolean) : [uris].filter(Boolean);
      if (!selected.length) return;
      router.replace({
        pathname: returnTo || '/screens/MediaComposerScreen',
        params: {
          media: JSON.stringify(selected),
          ...(chatReturnTo ? { chatReturnTo: String(chatReturnTo) } : {}),
          ...(roomId ? { roomId: String(roomId) } : {}),
          ...(roomKey ? { roomKey: String(roomKey) } : {}),
          ...(title ? { title: String(title) } : {}),
          ...(peerId ? { peerId: String(peerId) } : {}),
          ...(image ? { image: String(image) } : {}),
          ...(phone ? { phone: String(phone) } : {}),
        },
      });
    },
    [router, returnTo, chatReturnTo, roomId, roomKey, title, peerId, image, phone],
  );

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      if (!camPerm?.granted) await requestCamPerm();
      if (!medPerm?.granted) await requestMedPerm();
    })();
  }, [camPerm, medPerm, requestCamPerm, requestMedPerm]);

  // Load recent photos
  useEffect(() => {
    (async () => {
      if (!medPerm?.granted) return;
      try {
        setLoadingRecent(true);
        const { assets } = await MediaLibrary.getAssetsAsync({
          first: 25,
          mediaType: ['photo'],
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        setRecent(assets);
      } catch (e) {
        console.warn('Media load error:', e);
      } finally {
        setLoadingRecent(false);
      }
    })();
  }, [medPerm]);

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });
      onSelect(photo.uri);
    } catch (e) {
      console.warn('takePictureAsync error', e);
    }
  };

  const openGallery = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: 10,
      });
      if (!res.canceled) {
        onSelect((res.assets || []).map(asset => asset?.uri));
      }
    } catch (e) {
      console.warn('ImagePicker error', e);
    }
  };

  const toggleFlash = () => {
    setFlash((f) => {
      switch (f) {
        case CamFlash.off:
          return CamFlash.on;
        case CamFlash.on:
          return CamFlash.auto;
        case CamFlash.auto:
          return CamFlash.torch;
        default:
          return CamFlash.off;
      }
    });
  };

  const flipCamera = () => {
    setType((t) => (t === CamType.back ? CamType.front : CamType.back));
  };

  // Permission UI
  if (camPerm == null || medPerm == null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!camPerm.granted) {
    return (
      <PermissionBlock
        title="Camera permission needed"
        onPress={requestCamPerm}
      />
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={type}
        flash={flash}
        ratio="16:9"
      />

      {/* Close button */}
      <SafeAreaView
        pointerEvents="box-none"
        style={[styles.topBar, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.topBtn} onPress={toggleFlash}>
          <Ionicons
            name={
              flash === CamFlash.off
                ? 'flash-off'
                : flash === CamFlash.torch
                ? 'flashlight'
                : 'flash'
            }
            size={28}
            color="#fff"
          />
        </TouchableOpacity>

      </SafeAreaView>

      {/* Recent photos strip */}
      <View style={[styles.stripWrap, { bottom: 140 }]}>
        {loadingRecent ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <FlatList
            horizontal
            data={recent}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.thumbBtn}
                onPress={() => onSelect(item.uri)}
              >
                <Image source={{ uri: item.uri }} style={styles.thumb} />
              </TouchableOpacity>
            )}
            ListHeaderComponent={
              <TouchableOpacity style={styles.galleryBtn} onPress={openGallery}>
                <Ionicons name="images" size={28} color="#fff" />
              </TouchableOpacity>
            }
          />
        )}
      </View>

      {/* Bottom controls */}
      <SafeAreaView
        pointerEvents="box-none"
        style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}
      >
        <TouchableOpacity style={styles.smallBtn} onPress={openGallery}>
          <Ionicons name="image" size={26} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.shutterOuter} onPress={takePhoto}>
          <View style={styles.shutterInner} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.smallBtn} onPress={flipCamera}>
          <MaterialIcons name="flip-camera-android" size={26} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

function PermissionBlock({ title, onPress }) {
  return (
    <View style={styles.center}>
      <Text style={{ color: '#fff', marginBottom: 12 }}>{title}</Text>
      <TouchableOpacity onPress={onPress} style={styles.permBtn}>
        <Text style={{ color: '#000', fontWeight: '600' }}>Grant</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },

  topBar: {
    position: 'absolute',
    top: 0,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  topBtn: {
    padding: 6,
    marginHorizontal: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 20,
  },

  stripWrap: {
    position: 'absolute',
    width: '100%',
    paddingVertical: 6,
  },
  galleryBtn: {
    width: 60,
    height: 60,
    marginHorizontal: 8,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  thumbBtn: {
    marginHorizontal: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  thumb: {
    width: 60,
    height: 60,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  shutterOuter: {
    width: 74,
    height: 74,
    borderWidth: 4,
    borderColor: '#fff',
    borderRadius: 37,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
  smallBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  center: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 6,
  },
});

export default CameraScreen;