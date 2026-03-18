import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';


export default function ProfilePhotoScreen() {
  const router = useRouter();
  const { uri } = useLocalSearchParams();

  const [photoUri] = useState(uri);
  const insets = useSafeAreaInsets();




  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="black" barStyle="light-content" />

       <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Icon name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Image
        source={{ uri: photoUri }}
        style={styles.image}
        resizeMode="contain"
      />
     
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute',
    top: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    zIndex: 2,
  },
  backButton: { padding: 6 },
  editButton: { padding: 6 },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
    marginTop: 50,
  },
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  sheetOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  optionBtn: { alignItems: 'center' },
  optionText: {
    fontSize: 13,
    color: '#333',
    marginTop: 6,
  },
});
