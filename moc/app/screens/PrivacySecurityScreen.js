import { useRouter } from 'expo-router';

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Icon from 'react-native-vector-icons/MaterialIcons';

export default function PrivacySecurityScreen() {
  const router = useRouter();
 

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy & Security</Text>
      </View>

      {/* Options */}
      <TouchableOpacity style={styles.optionRow} onPress={() => router.push('/screens/LastSeenOnlineScreen')}>
        <Text style={styles.optionText}>Last Seen & Online</Text>
        <Icon name="chevron-right" size={22} color="#888" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionRow} onPress={() => router.push('/screens/ProfilePhotoOptions')}>
        <Text style={styles.optionText}>Profile Photo</Text>
        <Icon name="chevron-right" size={22} color="#888" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionRow} onPress={() => router.push('/screens/BlockedContactsScreen')}>
        <Text style={styles.optionText}>Blocked Contacts</Text>
        <Icon name="chevron-right" size={22} color="#888" />
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 16,
    color: '#222',
  },
});
