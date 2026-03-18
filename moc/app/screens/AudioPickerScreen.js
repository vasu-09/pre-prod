// screens/AudioPickerScreen.js
import { Audio } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

const inferFileNameFromUri = uri => {
  if (!uri || typeof uri !== 'string') return 'audio-file';
  const clean = uri.split('?')[0];
  const parts = clean.split('/');
  const last = parts[parts.length - 1];
  return last && last.trim() ? decodeURIComponent(last) : 'audio-file';
};

const formatBytes = bytes => {
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const normalizePickedAsset = (asset, index = 0) => {
  if (!asset?.uri) return null;

  const filename =
    typeof asset.name === 'string' && asset.name.trim()
      ? asset.name
      : inferFileNameFromUri(asset.uri);

  return {
    id: `${asset.uri}::${index}`,
    uri: asset.uri,
    filename,
    mimeType:
      typeof asset.mimeType === 'string' && asset.mimeType
        ? asset.mimeType
        : 'audio/*',
    sizeBytes: typeof asset.size === 'number' ? asset.size : null,
    lastModified:
      typeof asset.lastModified === 'number' ? asset.lastModified : null,
  };
};

export default function AudioPickerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [assets, setAssets] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sound, setSound] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPicking, setIsPicking] = useState(false);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  const stopPlayback = async () => {
    if (!sound) return;
    try {
      await sound.unloadAsync();
    } catch {}
    setSound(null);
    setPlayingId(null);
  };

  const pickAudioFiles = async () => {
    try {
      setIsPicking(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const picked = (result.assets || [])
        .map((asset, index) => normalizePickedAsset(asset, index))
        .filter(Boolean);

      if (!picked.length) return;

      setAssets(prev => {
        const byUri = new Map(prev.map(item => [item.uri, item]));
        for (const item of picked) {
          byUri.set(item.uri, item);
        }
        return Array.from(byUri.values());
      });

      setSelectedIds(prev => {
        const merged = new Set(prev);
        for (const item of picked) {
          merged.add(item.id);
        }
        return Array.from(merged);
      });
    } catch (err) {
      console.warn('Audio document picker error:', err);
    } finally {
      setIsPicking(false);
    }
  };

  const handlePlayPause = async asset => {
    try {
      if (playingId === asset.id && sound) {
        await stopPlayback();
        return;
      }

      await stopPlayback();

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: asset.uri },
        { shouldPlay: true }
      );

      setSound(newSound);
      setPlayingId(asset.id);

      newSound.setOnPlaybackStatusUpdate(status => {
        if (status?.didJustFinish) {
          newSound.unloadAsync().catch(() => {});
          setSound(null);
          setPlayingId(null);
        }
      });
    } catch (err) {
      console.warn('Audio preview error:', err);
      await stopPlayback();
    }
  };

  const toggleSelect = assetId => {
    setSelectedIds(ids =>
      ids.includes(assetId)
        ? ids.filter(id => id !== assetId)
        : [...ids, assetId]
    );
  };

  const handleSend = () => {
    const selectedAssets = assets.filter(a => selectedIds.includes(a.id));
    if (!selectedAssets.length) return;

    router.replace({
      pathname: '/screens/ChatDetailScreen',
      params: {
        audio: JSON.stringify(selectedAssets),
        ...(params?.roomId ? { roomId: String(params.roomId) } : {}),
        ...(params?.roomKey ? { roomKey: String(params.roomKey) } : {}),
        ...(params?.peerId ? { peerId: String(params.peerId) } : {}),
        ...(params?.phone ? { phone: String(params.phone) } : {}),
        ...(params?.title ? { title: String(params.title) } : {}),
        ...(params?.image ? { image: String(params.image) } : {}),
      },
    });
  };

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(a =>
      String(a.filename || '').toLowerCase().includes(q)
    );
  }, [assets, searchQuery]);

  const renderItem = ({ item }) => {
    const isPlaying = playingId === item.id;
    const isSelected = selectedIds.includes(item.id);

    return (
      <TouchableOpacity
        style={[styles.item, isSelected && styles.itemSelected]}
        onPress={() => toggleSelect(item.id)}
        activeOpacity={0.85}
      >
        <View style={styles.info}>
          <Icon name="audiotrack" size={24} color="#666" />
          <View style={styles.metaBlock}>
            <Text style={styles.filename} numberOfLines={1}>
              {item.filename}
            </Text>
            {!!item.sizeBytes && (
              <Text style={styles.metaText}>{formatBytes(item.sizeBytes)}</Text>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          {isSelected && (
            <Icon
              name="check-circle"
              size={24}
              color="#1f6ea7"
              style={{ marginRight: 12 }}
            />
          )}
          <TouchableOpacity onPress={() => handlePlayPause(item)}>
            <Icon
              name={isPlaying ? 'pause-circle-filled' : 'play-circle-filled'}
              size={30}
              color="#1f6ea7"
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {isSearching ? (
        <View style={[styles.searchHeader, { paddingTop: insets.top }]}>
          <TouchableOpacity
            onPress={() => {
              setIsSearching(false);
              setSearchQuery('');
            }}
            style={styles.searchBackBtn}
          >
            <Icon name="arrow-back" size={24} color="#1f6ea7" />
          </TouchableOpacity>

          <TextInput
            style={styles.searchInput}
            placeholder="Search selected audio..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            underlineColorAndroid="transparent"
          />

          <TouchableOpacity onPress={pickAudioFiles} style={styles.searchBackBtn}>
            <Icon name="folder-open" size={24} color="#1f6ea7" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.title}>Audio files</Text>
            <Text style={styles.subtitle}>
              {selectedIds.length} selected
            </Text>
          </View>

          {assets.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setIsSearching(true);
                setSearchQuery('');
              }}
              style={styles.iconBtn}
            >
              <Icon name="search" size={28} color="#fff" />
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={pickAudioFiles} style={styles.iconBtn}>
            <Icon name="folder-open" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {isPicking ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#1f6ea7" />
          <Text style={styles.centerText}>Opening audio picker...</Text>
        </View>
      ) : assets.length === 0 ? (
        <View style={styles.centerState}>
          <Icon name="library-music" size={52} color="#1f6ea7" />
          <Text style={styles.emptyTitle}>Pick audio files</Text>
          <Text style={styles.emptySubtext}>
            This refactor uses the system file picker.
            It no longer scans the full device music library.
          </Text>

          <TouchableOpacity style={styles.pickBtn} onPress={pickAudioFiles}>
            <Icon name="folder-open" size={22} color="#fff" />
            <Text style={styles.pickBtnText}>Choose audio files</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredAssets}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.centerText}>No matching audio files</Text>
            </View>
          }
        />
      )}

      {selectedIds.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 16 }]}
          onPress={handleSend}
        >
          <Icon name="send" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef5fa' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f6ea7',
    paddingHorizontal: 8,
    minHeight: 56,
  },
  iconBtn: { padding: 8 },

  titleContainer: {
    flex: 1,
    flexDirection: 'column',
    marginLeft: 8,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#fff',
    fontSize: 14,
    marginTop: 2,
  },

  searchHeader: {
    minHeight: 56,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  searchBackBtn: { padding: 8 },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },

  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  centerText: {
    marginTop: 12,
    color: '#555',
    textAlign: 'center',
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '700',
    color: '#1f6ea7',
  },
  emptySubtext: {
    marginTop: 8,
    textAlign: 'center',
    color: '#555',
    lineHeight: 20,
  },
  pickBtn: {
    marginTop: 18,
    backgroundColor: '#1f6ea7',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickBtnText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 8,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
    justifyContent: 'space-between',
    backgroundColor: '#eef5fa',
  },
  itemSelected: {
    backgroundColor: '#d8f0fc',
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metaBlock: {
    marginLeft: 12,
    flex: 1,
  },
  filename: {
    fontSize: 16,
    color: '#333',
    flexShrink: 1,
  },
  metaText: {
    marginTop: 4,
    fontSize: 12,
    color: '#777',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },

  fab: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#1f6ea7',
    borderRadius: 28,
    padding: 16,
    elevation: 4,
  },
});