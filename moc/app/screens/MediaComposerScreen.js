import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { compressImageForChatStandard } from '../services/imageCompression';

const normalizeMediaEntry = entry => {
  if (!entry) return null;
  if (typeof entry === 'string') {
    return { uri: entry };
  }
  if (typeof entry?.uri === 'string' && entry.uri) {
    return {
      uri: entry.uri,
      width: typeof entry?.width === 'number' ? entry.width : undefined,
      height: typeof entry?.height === 'number' ? entry.height : undefined,
      mimeType: typeof entry?.mimeType === 'string' ? entry.mimeType : undefined,
    };
  }
  return null;
};

export default function MediaComposerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);

  const initialMedia = useMemo(() => {
    const raw = Array.isArray(params?.media) ? params.media[0] : params?.media;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(normalizeMediaEntry).filter(Boolean);
    } catch {
      return [normalizeMediaEntry(raw)].filter(Boolean);
    }
    return [];
  }, [params?.media]);

  const [selectedMedia, setSelectedMedia] = useState(initialMedia);
  const activeMedia = selectedMedia[0]?.uri || null;

  const addMoreMedia = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: 10,
        quality: 0.8,
      });
      if (res.canceled) return;
      const additional = (res.assets || []).map(normalizeMediaEntry).filter(Boolean);
      if (!additional.length) return;
      setSelectedMedia(prev => [...prev, ...additional]);
    } catch (err) {
      console.warn('Failed to add more media', err);
    }
  };

  const handleSend = async () => {
    if (!selectedMedia.length || isSending) return;
    setIsSending(true);
    try {
      const compressedMedia = [];
      for (const mediaItem of selectedMedia) {
        const originalUri = mediaItem?.uri;
        if (!originalUri) continue;

        try {
          const compressed = await compressImageForChatStandard(mediaItem);
          console.log(
            `[MediaComposer] Compression ${originalUri} | original=${compressed?.originalSizeBytes ?? 'n/a'}B compressed=${compressed?.compressedSizeBytes ?? 'n/a'}B`,
          );
          compressedMedia.push(compressed);
        } catch (err) {
          console.warn('Failed to compress image, falling back to original', err);
          compressedMedia.push({
            uri: originalUri,
            mimeType: mediaItem?.mimeType || 'image/jpeg',
            width: mediaItem?.width ?? null,
            height: mediaItem?.height ?? null,
            originalUri,
            originalSizeBytes: null,
            compressedSizeBytes: null,
            wasCompressed: false,
          });
        }
      }

      if (!compressedMedia.length) {
        return;
      }

      const payload = JSON.stringify({
        media: compressedMedia,
        caption: caption.trim(),
      });
      router.replace({
        pathname: params?.chatReturnTo ? String(params.chatReturnTo) : '/screens/ChatDetailScreen',
        params: {
          mediaPayload: payload,
          ...(params?.roomId ? { roomId: String(params.roomId) } : {}),
          ...(params?.roomKey ? { roomKey: String(params.roomKey) } : {}),
          ...(params?.title ? { title: String(params.title) } : {}),
          ...(params?.peerId ? { peerId: String(params.peerId) } : {}),
          ...(params?.image ? { image: String(params.image) } : {}),
          ...(params?.phone ? { phone: String(params.phone) } : {}),
        },
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}> 
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="close" color="#fff" size={24} />
        </TouchableOpacity>
        <View style={styles.toolsRow}>
          <TouchableOpacity style={styles.topBtn}><MaterialIcons name="crop" color="#fff" size={20} /></TouchableOpacity>
          <TouchableOpacity style={styles.topBtn}><MaterialIcons name="emoji-emotions" color="#fff" size={20} /></TouchableOpacity>
          <TouchableOpacity style={styles.topBtn}><MaterialIcons name="text-fields" color="#fff" size={20} /></TouchableOpacity>
          <TouchableOpacity style={styles.topBtn}><MaterialIcons name="edit" color="#fff" size={20} /></TouchableOpacity>
        </View>
      </View>

      <View style={styles.previewWrap}>
        {activeMedia ? <Image source={{ uri: activeMedia }} style={styles.previewImage} resizeMode="contain" /> : null}
      </View>

      <View style={styles.bottomStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
          <TouchableOpacity style={styles.addMore} onPress={addMoreMedia}>
            <Ionicons name="add" color="#fff" size={22} />
          </TouchableOpacity>
          {selectedMedia.map(item => (
            <Image key={item.uri} source={{ uri: item.uri }} style={styles.thumb} />
          ))}
        </ScrollView>

        <View style={styles.captionRow}>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Add a caption"
            placeholderTextColor="#9ca3af"
            style={styles.captionInput}
          />
          <TouchableOpacity
            style={[styles.sendBtn, isSending && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={isSending}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        {isSending ? <Text style={styles.sendingText}>Compressing images...</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  toolsRow: { flexDirection: 'row' },
  previewWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: '100%', height: '100%' },
  bottomStrip: { padding: 12, backgroundColor: '#0b0b0b' },
  thumbRow: { alignItems: 'center' },
  addMore: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumb: { width: 58, height: 58, borderRadius: 8, marginRight: 8 },
  captionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  captionInput: {
    flex: 1,
    backgroundColor: '#111827',
    color: '#fff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 10,
  },
  sendBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
      opacity: 0.6,
    },
    sendingText: {
      color: '#d1d5db',
      marginTop: 8,
      fontSize: 12,
    },
});