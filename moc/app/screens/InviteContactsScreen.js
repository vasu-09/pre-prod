import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useContactSync } from '../hooks/useContactSync';

const INVITE_MESSAGE =
  'Hey! I am using MoC to stay connected. Download the app and join me: https://moc-app.example/invite';

export default function InviteContactsScreen() {
  const router = useRouter();
  const {
    contacts: inviteContacts,
    isLoading,
    isRefreshing,
    error,
    permissionDenied,
    refresh,
  } = useContactSync({ selector: 'invite', refreshOnMount: true, staleMs: 5 * 60 * 1000 });

  const contacts = useMemo(
    () =>
      inviteContacts
        .map(contact => {
          const phoneNumbers = contact.phoneNumbers ?? [];
          const displayPhone = phoneNumbers[0]?.number ?? contact.matchPhone ?? '';

          return {
            id: contact.id ?? `${contact.name}-${displayPhone}`,
            name: contact.name?.trim() || displayPhone || 'Unknown contact',
            phone: displayPhone,
            imageUri: contact.imageUri ?? null,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [inviteContacts],
  );

    const handleInvite = async () => {
    try {
      await Share.share({
        message: INVITE_MESSAGE,
        title: 'Invite to MoC',
      });
    } catch (inviteError) {
      console.error('Failed to send invite', inviteError);
    }
  };

  const renderContact = ({ item }) => (
    <View style={styles.contactRow}>
      <View style={styles.contactInfo}>
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholderAvatar]}>
            <Icon name="person" size={24} color="#888" />
          </View>
        )}
        <View style={styles.nameWrapper}>
          <Text style={styles.contactName}>{item.name}</Text>
          {item.phone ? <Text style={styles.contactPhone}>{item.phone}</Text> : null}
        </View>
      </View>
            <TouchableOpacity style={styles.inviteButton} onPress={handleInvite}>
        <Text style={styles.inviteButtonText}>Invite</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      {isLoading ? (
        <>
          <ActivityIndicator color="#1f6ea7" />
          <Text style={styles.emptyText}>Loading contacts…</Text>
        </>
      ) : (
         <Text style={styles.emptyText}>
          {error ||
            (permissionDenied
              ? 'MoC needs contact permission to refresh invite suggestions.'
              : 'No contacts to invite right now.')}
        </Text>
      )}
    </View>
  );

  return (
     <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1f6ea7" barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invite friends</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <FlatList
        data={contacts}
        keyExtractor={item => item.id}
        renderItem={renderContact}
        contentContainerStyle={contacts.length ? styles.listContent : styles.emptyListContent}
        ListEmptyComponent={renderEmpty}
         refreshing={isRefreshing}
        onRefresh={() => refresh(true)}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  header: {
    height: 56,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  iconButton: {
    padding: 4,
  },
  iconPlaceholder: {
    width: 24,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  nameWrapper: {
    marginLeft: 12,
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  contactPhone: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e3e3e3',
  },
  placeholderAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteButton: {
    borderColor: '#1f6ea7',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  inviteButtonText: {
    color: '#1f6ea7',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#666',
  },
  separator: {
    height: 10,
  },
});