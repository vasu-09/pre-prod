import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';


const ACTIONS = [
  { icon: 'volume-off', label: 'mute' },
  { icon: 'videocam', label: 'video' },
  { icon: 'call', label: 'call' },
  { icon: 'message', label: 'message' },
];

export default function ContactProfileScreen() {
  const { name, image, phone, media } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const sharedMedia = media ? JSON.parse(media) : [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.topSection, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        {image ? (
          <Image source={{ uri: image }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Icon name="person" size={64} color="#1f6ea7" />
          </View>
        )}
        <Text style={styles.name}>{name}</Text>
        {phone ? <Text style={styles.phone}>{phone}</Text> : null}
        <View style={styles.actionsRow}>
          {ACTIONS.map(({ icon, label }) => (
            <TouchableOpacity key={label} style={styles.actionItem}>
              <View style={styles.actionCircle}>
                <Icon name={icon} size={24} color="#1f6ea7" />
              </View>
              <Text style={styles.actionLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {sharedMedia.length > 0 && (
        <View style={styles.mediaSection}>
          <Text style={styles.mediaTitle}>Shared Media</Text>
          <FlatList
            data={sharedMedia}
            keyExtractor={(item, index) => index.toString()}
            numColumns={3}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.mediaImage} />
            )}
          />
          <TouchableOpacity style={styles.seeAllBtn}>
            <Text style={styles.seeAllText}>see all</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.dangerZone}>
        <TouchableOpacity style={styles.dangerItem}>
          <Icon name="block" size={24} color="#d22" />
          <Text style={styles.dangerText}>Block</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dangerItem}>
          <Icon name="report" size={24} color="#d22" />
          <Text style={styles.dangerText}>Report Spam</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topSection: {
    backgroundColor: '#1f6ea7',
    alignItems: 'center',
    paddingBottom: 16,
  },
  backBtn: { alignSelf: 'flex-start', padding: 8 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: { fontSize: 20, fontWeight: '600', color: '#fff' },
  phone: { fontSize: 16, color: '#fff', marginTop: 4 },
  actionsRow: { flexDirection: 'row', marginTop: 16 },
  actionItem: { alignItems: 'center', marginHorizontal: 12 },
  actionCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionLabel: { color: '#fff', fontSize: 12 },
  mediaSection: { paddingHorizontal: 16, paddingTop: 16 },
  mediaTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#333' },
  mediaImage: {
    width: 100,
    height: 100,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 8,
  },
  seeAllBtn: { alignSelf: 'center', marginTop: 8 },
  seeAllText: { color: '#1f6ea7' },
  dangerZone: { marginTop: 16 },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  dangerText: { marginLeft: 16, fontSize: 16, color: '#d22' },
});