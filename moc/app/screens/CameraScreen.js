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

const isVideoAsset = (item) => {
  const mediaType = item?.mediaType;
  return (
    mediaType === 'video' ||
    mediaType === MediaLibrary.MediaType?.video ||
    item?.mimeType?.startsWith('video/')
  );
};

const normalizeSelectedItem = (item) => {
  if (!item) return null;

  if (typeof item === 'string') {
    return { uri: item, mediaType: 'photo' };
  }

  if (typeof item?.uri === 'string' && item.uri) {
    const isVideo = isVideoAsset(item);

    return {
      uri: item.uri,
      width: typeof item?.width === 'number' ? item.width : undefined,
      height: typeof item?.height === 'number' ? item.height : undefined,
      mimeType:
        typeof item?.mimeType === 'string'
          ? item.mimeType
          : isVideo
          ? 'video/mp4'
          : 'image/jpeg',
      mediaType: isVideo ? 'video' : 'photo',
      duration: typeof item?.duration === 'number' ? item.duration : undefined,
      filename:
        typeof item?.filename === 'string'
          ? item.filename
          : typeof item?.name === 'string'
          ? item.name
          : undefined,
      assetId: item?.id ? String(item.id) : undefined,
    };
  }

  return null;
};

const formatDuration = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return '';

  // Some APIs return seconds, some milliseconds. Normalize roughly.
  const totalSeconds = value > 1000 ? Math.floor(value / 1000) : Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

function CameraScreen() {
  const router = useRouter();
  const {
    returnTo,
    chatReturnTo,
    roomId,
    roomKey,
    title,
    peerId,
    image,
    phone,
  } = useLocalSearchParams();

  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [medPerm, requestMedPerm] = MediaLibrary.usePermissions({
    writeOnly: false,
    granularPermissions: ['photo', 'video'],
  });

  const [type, setType] = useState(CamType.back);
  const [flash, setFlash] = useState(CamFlash.off);

  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const onSelect = useCallback(
    (items) => {
      const selected = Array.isArray(items)
        ? items.map(normalizeSelectedItem).filter(Boolean)
        : [normalizeSelectedItem(items)].filter(Boolean);

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
    [router, returnTo, chatReturnTo, roomId, roomKey, title, peerId, image, phone]
  );

  useEffect(() => {
    (async () => {
      try {
        if (!camPerm?.granted) {
          await requestCamPerm();
        }
        if (!medPerm?.granted) {
          await requestMedPerm();
        }
      } catch (e) {
        console.warn('Permission request error:', e);
      }
    })();
  }, [camPerm, medPerm, requestCamPerm, requestMedPerm]);

  const loadRecentMedia = useCallback(async () => {
    if (!medPerm?.granted) {
      setRecent([]);
      setLoadingRecent(false);
      return;
    }

    try {
      setLoadingRecent(true);

      const page = await MediaLibrary.getAssetsAsync({
        first: 40,
        mediaType: ['photo', 'video'],
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });

      setRecent(page?.assets || []);
    } catch (e) {
      console.warn('Media load error:', e);
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  }, [medPerm]);

  useEffect(() => {
    loadRecentMedia();
  }, [loadRecentMedia]);

  const takePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });
      onSelect(photo);
    } catch (e) {
      console.warn('takePictureAsync error', e);
    }
  };

  const openGallery = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: 10,
      });

      if (!res.canceled) {
        onSelect(res.assets || []);
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

  const openRecentItem = (item) => {
    onSelect({
      uri: item.uri,
      width: item.width,
      height: item.height,
      mediaType: isVideoAsset(item) ? 'video' : 'photo',
      mimeType:
        item?.mimeType ||
        (isVideoAsset(item) ? 'video/mp4' : 'image/jpeg'),
      duration: item?.duration,
      filename: item?.filename,
      id: item?.id,
    });
  };

  const renderRecentItem = ({ item }) => {
    const isVideo = isVideoAsset(item);

    return (
      <TouchableOpacity
        style={styles.thumbBtn}
        activeOpacity={0.85}
        onPress={() => openRecentItem(item)}
      >
        {isVideo ? (
          <View style={styles.videoThumb}>
            <Ionicons name="play-circle" size={24} color="#fff" />
            {!!formatDuration(item?.duration) && (
              <Text style={styles.videoDuration}>{formatDuration(item?.duration)}</Text>
            )}
          </View>
        ) : (
          <Image source={{ uri: item.uri }} style={styles.thumb} />
        )}
      </TouchableOpacity>
    );
  };

  if (camPerm == null || medPerm == null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
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

  if (!medPerm.granted) {
    return (
      <PermissionBlock
        title="Photos and videos permission needed"
        onPress={requestMedPerm}
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

      <View style={[styles.stripWrap, { bottom: 140 }]}>
        {loadingRecent ? (
          <View style={styles.loadingStrip}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : (
          <FlatList
            data={recent}
            keyExtractor={(item) => String(item.id)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripList}
            renderItem={renderRecentItem}
            ListHeaderComponent={
              <TouchableOpacity style={styles.galleryBtn} onPress={openGallery}>
                <Ionicons name="images" size={28} color="#fff" />
              </TouchableOpacity>
            }
          />
        )}
      </View>

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
      <Text style={styles.permissionText}>{title}</Text>
      <TouchableOpacity onPress={onPress} style={styles.permBtn}>
        <Text style={styles.permBtnText}>Grant</Text>
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
  loadingStrip: {
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stripList: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  galleryBtn: {
    width: 60,
    height: 60,
    marginHorizontal: 4,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  thumbBtn: {
    marginHorizontal: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  videoThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoDuration: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 4,
    borderRadius: 4,
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
    paddingHorizontal: 24,
  },
  permissionText: {
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  permBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 6,
  },
  permBtnText: {
    color: '#000',
    fontWeight: '600',
  },
});

export default CameraScreen;