// screens/AudioPickerScreen.js
import { Audio } from 'expo-audio';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';


export default function AudioPickerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [assets, setAssets] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sound, setSound] = useState(null);
  const [playingId, setPlayingId] = useState(null);

  // NEW: search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return;
      const { assets } = await MediaLibrary.getAssetsAsync({
        mediaType: 'audio',
        first: 200,
      });
      setAssets(assets);
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (sound) sound.unloadAsync();
    };
  }, [sound]);

  const handlePlayPause = async asset => {
    if (playingId === asset.id) {
      await sound.pauseAsync();
      setPlayingId(null);
      return;
    }
    if (sound) {
      await sound.unloadAsync();
    }
    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: asset.uri },
      { shouldPlay: true }
    );
    setSound(newSound);
    setPlayingId(asset.id);
    newSound.setOnPlaybackStatusUpdate(status => {
      if (status.didJustFinish) {
        newSound.unloadAsync();
        setPlayingId(null);
      }
    });
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
    router.replace({
      pathname: '/screens/ChatDetailScreen',
      params: { audio: JSON.stringify(selectedAssets) },
    });
  };

  // NEW: filtered list
  const filteredAssets = assets.filter(a =>
    a.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }) => {
    const isPlaying = playingId === item.id;
    const isSelected = selectedIds.includes(item.id);

    return (
      <TouchableOpacity
        style={[styles.item, isSelected && styles.itemSelected]}
        onPress={() => toggleSelect(item.id)}
      >
        <View style={styles.info}>
          <Icon name="music-note" size={24} color="#666" />
          <Text style={styles.filename} numberOfLines={1}>
            {item.filename}
          </Text>
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
              size={28}
              color="#1f6ea7"
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* ─── Conditional Header ──────────────────────────────────────── */}
      {isSearching ? (
        <View style={[styles.searchHeader, { paddingTop: insets.top }]}>
          <TouchableOpacity
            onPress={() => setIsSearching(false)}
            style={styles.searchBackBtn}
          >
            <Icon name="arrow-back" size={24} color="#1f6ea7" />
          </TouchableOpacity>
            <TextInput
            style={styles.searchInput}
            placeholder="Search audio..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            underlineColorAndroid="transparent"
          />
        </View>
      ) : (
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
           <View style={styles.titleContainer}>
                <Text style={styles.title}>contacts to send</Text>
                <Text style={styles.subtitle}> {selectedIds.length} selected</Text>
              </View>
          <TouchableOpacity
            onPress={() => {
              setIsSearching(true);
              setSearchQuery('');
            }}
            style={styles.iconBtn}
          >
            <Icon name="search" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Audio List ──────────────────────────────────────────────── */}
      <FlatList
        data={filteredAssets}                 // use filteredAssets
        keyExtractor={a => a.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      />

      {/* ─── Send FAB ───────────────────────────────────────────────── */}
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

  // ── Normal Header ───────────────────────────────────────────────
 header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f6ea7',
    paddingHorizontal: 8,
    height: 56,
    // remove fixed height so it can grow with two lines
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

  // ── Search Header ───────────────────────────────────────────────
  searchHeader: {
    height: 56,
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

  // ── List Items ─────────────────────────────────────────────────
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
    justifyContent: 'space-between',
  },
  itemSelected: {
    backgroundColor: '#d8f0fc',
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  filename: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
    flexShrink: 1,
  },
  actions: { flexDirection: 'row', alignItems: 'center' },

  // ── FAB ────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#1f6ea7',
    borderRadius: 28,
    padding: 16,
    elevation: 4,
  },


});
