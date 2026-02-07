import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Icon from 'react-native-vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';

const dummyBlocked = [
  {
    id: '1',
    name: 'John Doe',
    avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
  },
  {
    id: '2',
    name: 'Harika Gurazala',
    avatar: 'https://randomuser.me/api/portraits/women/2.jpg',
  },
];

export default function BlockedContactsScreen() {
  const router = useRouter();
  const [blockedUsers, setBlockedUsers] = useState(dummyBlocked);

  const handleUnblock = (userId) => {
    setBlockedUsers((prev) => prev.filter((user) => user.id !== userId));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Blocked Contacts</Text>
        <TouchableOpacity onPress={() => {/* Navigate to contact picker */}}>
          <Icon name="person-add" size={24} color="#1f6ea7" />
        </TouchableOpacity>
      </View>

      <Text style={styles.infoText}>
        Blocked contacts will no longer be able to call you or send you messages.
      </Text>

      {/* Blocked List */}
      {blockedUsers.length === 0 ? (
        <Text style={styles.emptyText}>No blocked contacts</Text>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.userRow}>
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
              <Text style={styles.name}>{item.name}</Text>
              <TouchableOpacity onPress={() => handleUnblock(item.id)}>
                <Text style={styles.unblockText}>Unblock</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  title: { fontSize: 18, fontWeight: '600' },
  infoText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 14,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 12 },
  name: { flex: 1, fontSize: 16 },
  unblockText: {
    color: '#e53935',
    fontSize: 14,
    fontWeight: '600',
  },
});
