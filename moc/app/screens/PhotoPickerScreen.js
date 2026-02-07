// screens/PhotoPickerScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function PhotoPickerScreen() {
  const [photos, setPhotos] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return;

      const { assets } = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        first: 200,
        sortBy: 'modificationTime',
      });
      setPhotos(assets);
    })();
  }, []);

  const toggleSelect = (id) =>
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const handleSend = () => {
    const selected = photos.filter((p) => selectedIds.includes(p.id));
    router.replace({
      pathname: '/ChatDetailScreen',
      params: { photos: JSON.stringify(selected) },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
       <TouchableOpacity         onPress={() => {
                  if (router.canGoBack()) router.back();
                   else router.replace('/screens/MocScreen');
                 }}
                 style={styles.iconBtn}
               >
                 <Icon name="arrow-back" size={24} color="#1f6ea7" />
               </TouchableOpacity>
        <Text style={styles.title}>All Photos</Text>
        <TouchableOpacity onPress={handleSend} disabled={!selectedIds.length}>
          <Text
            style={[
              styles.sendText,
              { opacity: selectedIds.length ? 1 : 0.5 },
            ]}
          >
            Send
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSel = selectedIds.includes(item.id);
          return (
            <TouchableOpacity
              onPress={() => toggleSelect(item.id)}
              style={styles.imageWrapper}
            >
              <Image
                source={{ uri: item.uri }}
                style={[
                  styles.image,
                  isSel && { opacity: 0.5, borderWidth: 2, borderColor: '#1f6ea7' },
                ]}
              />
              {isSel && (
                <View style={styles.checkIcon}>
                  <Text style={{ color: '#fff' }}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        numColumns={3}
        contentContainerStyle={{ padding: 6 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  backText: { fontSize: 20 },
  title: { fontSize: 18, fontWeight: '600' },
  sendText: { fontSize: 16, color: '#1f6ea7' },
  imageWrapper: {
    flex: 1 / 3,
    aspectRatio: 1,
    padding: 4,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  checkIcon: {
  position: 'absolute',
  top: 8,
  right: 8,
  backgroundColor: '#1f6ea7',
  borderRadius: 30,       // ✅ This makes it circular
  width: 24,              // 👈 Size of the circle
  height: 24,
  justifyContent: 'center',
  alignItems: 'center',
},

});
