import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Modal from 'react-native-modal';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function ProfilePhotoScreen() {
  const router = useRouter();
  const { uri } = useLocalSearchParams();
  const initialUri = Array.isArray(uri) ? uri[0] : uri;
  const [showOptions, setShowOptions] = useState(false);
  const [photoUri, setPhotoUri] = useState(initialUri);
  const insets = useSafeAreaInsets();

  const openGallery = async () => {
    setShowOptions(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      const selectedUri = result.assets[0].uri;
      setPhotoUri(selectedUri);
      router.replace({
        pathname: '/screens/AccountSettings',
        params: { updatedUri: selectedUri },
      });
    }
  };

  const openCamera = () => {
    setShowOptions(false);
    router.push('/screens/CameraScreen');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="black" barStyle="light-content" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowOptions(true)} style={styles.editButton}>
          <Icon name="edit" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <Image
        source={{ uri: photoUri }}
        style={styles.image}
        resizeMode="contain"
      />

      <Modal
        isVisible={showOptions}
        onBackdropPress={() => setShowOptions(false)}
        style={styles.modal}
      >
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Profile photo</Text>
          <View style={styles.sheetOptions}>
            <TouchableOpacity style={styles.optionBtn} onPress={openCamera}>
              <Icon name="photo-camera" size={26} color="#1f6ea7" />
              <Text style={styles.optionText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionBtn} onPress={openGallery}>
              <Icon name="photo-library" size={26} color="#1f6ea7" />
              <Text style={styles.optionText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    padding: 12,
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
