import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';


const options = [
  'Everyone',
  'My Contacts',
  'Nobody',
];

export default function LastSeenOnlineScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState('My Contacts');
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Last Seen & Online</Text>
      </View>

      {/* Description */}
      <Text style={styles.info}>
        If you don’t share your Last Seen, you won’t be able to see others Last Seen either.
      </Text>

      {/* Options */}
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={styles.optionRow}
          onPress={() => setSelected(opt)}
        >
          <Text style={styles.optionText}>{opt}</Text>
          {selected === opt && <Icon name="check" size={20} color="#1f6ea7" />}
        </TouchableOpacity>
      ))}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Show Online Toggle Group */}
      <Text style={styles.subHeading}>Who can see when I’m online</Text>

      <TouchableOpacity
        style={styles.optionRow}
        onPress={() => setShowOnlineStatus(true)}
      >
        <Text style={styles.optionText}>Same as Last Seen</Text>
        {showOnlineStatus && <Icon name="check" size={20} color="#1f6ea7" />}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.optionRow}
        onPress={() => setShowOnlineStatus(false)}
      >
        <Text style={styles.optionText}>Nobody</Text>
        {!showOnlineStatus && <Icon name="check" size={20} color="#1f6ea7" />}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600' },
  info: {
    fontSize: 13,
    color: '#666',
    marginBottom: 24,
    lineHeight: 18,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 15,
    color: '#222',
  },
  divider: {
    height: 16,
    backgroundColor: '#f2f2f2',
    marginVertical: 24,
  },
  subHeading: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
    color: '#555',
  },
});
