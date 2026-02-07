import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';

const options = [
  'Everyone',
  'My Contacts',
  'Nobody',
];

export default function ProfilePhotoSettingsScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState('My Contacts');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Profile Photo</Text>
      </View>

      <Text style={styles.info}>
        If you don’t share your profile photo, others won’t be able to see it.
      </Text>

      {/* Option List */}
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={styles.optionRow}
          onPress={() => setSelected(opt)}
        >
          <Text style={styles.optionText}>{opt}</Text>
          {selected === opt && <Icon name="check" size={22} color="#1f6ea7" />}
        </TouchableOpacity>
      ))}
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
});
