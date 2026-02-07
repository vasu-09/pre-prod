// screens/PhotoGridScreen.js
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function PhotoGridScreen() {
  const { albumId, title } = useLocalSearchParams();
  const [photos, setPhotos] = useState([]);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { assets } = await MediaLibrary.getAssetsAsync({
        album: albumId,
        mediaType: 'photo',
        first: 200,
        sortBy: 'modificationTime',
      });
      setPhotos(assets);
    })();
  }, [albumId]);

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.imageWrapper}>
      <Image source={{ uri: item.uri }} style={styles.image} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backText}>←</Text></TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
      </View>
      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={3}
        contentContainerStyle={{ padding: 8 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  backText: { fontSize: 20, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  imageWrapper: {
    flex: 1 / 3,
    aspectRatio: 1,
    padding: 4,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
});
