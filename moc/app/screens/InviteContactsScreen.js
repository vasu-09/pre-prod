import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { getAllContactsFromDb, syncAndPersistContacts } from '../services/contactStorage';


const INVITE_MESSAGE =
  'Hey! I am using MoC to stay connected. Download the app and join me: https://moc-app.example/invite';

const loadDeviceContacts = async () => {
  const collected = [];
  let pageOffset = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
      sort: Contacts.SortTypes.FirstName,
      pageSize: 200,
      pageOffset,
    });

    collected.push(...response.data);
    hasNextPage = response.hasNextPage;
    pageOffset += response.data.length;
  }

  return collected;
};

export default function InviteContactsScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchContacts = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) {
        setIsLoading(true);
      }
      setErrorMessage('');

      try {
        let { status } = await Contacts.getPermissionsAsync();
        if (status !== 'granted') {
          const request = await Contacts.requestPermissionsAsync();
          status = request.status;
        }

        if (status !== 'granted') {
          setContacts([]);
          setErrorMessage('MoC needs permission to access your contacts to send invites.');
          return;
        }

        const deviceContacts = await loadDeviceContacts();
        const withNumbers = deviceContacts.filter(contact => (contact.phoneNumbers ?? []).length > 0);

        if (!withNumbers.length) {
          setContacts([]);
          setErrorMessage('No contacts with phone numbers were found on your device.');
          return;
        }

        // Persist synced contacts locally so invite options always read from SQLite.
        await syncAndPersistContacts(withNumbers);

        const storedContacts = await getAllContactsFromDb();

        const inviteCandidates = storedContacts
          .filter(contact => (contact.phoneNumbers ?? []).length > 0 && contact.matchUserId == null)
          .map(contact => {
            const phoneNumbers = contact.phoneNumbers ?? [];
            const displayPhone = phoneNumbers[0]?.number ?? contact.matchPhone ?? '';

            return {
              id: contact.id ?? `${contact.name}-${Math.random().toString(36).slice(2)}`,
              name: contact.name?.trim() || displayPhone || 'Unknown contact',
              phone: displayPhone,
               imageUri: contact.imageUri ?? null,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        setContacts(inviteCandidates);

        if (!inviteCandidates.length) {
          setErrorMessage('Everyone in your address book is already on MoC. Great job!');
        }
      } catch (error) {
        console.error('Failed to load contacts to invite', error);
        setContacts([]);
        setErrorMessage('Unable to load contacts right now. Please try again later.');
      } finally {
        if (showSpinner) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    fetchContacts(true);
  }, [fetchContacts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchContacts(false);
    setRefreshing(false);
  }, [fetchContacts]);

  const handleInvite = async contact => {
    try {
      await Share.share({
        message: INVITE_MESSAGE,
        title: 'Invite to MoC',
      });
    } catch (error) {
      console.error('Failed to send invite', error);
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
      <TouchableOpacity style={styles.inviteButton} onPress={() => handleInvite(item)}>
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
        <Text style={styles.emptyText}>{errorMessage || 'No contacts to invite right now.'}</Text>
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
        refreshing={refreshing}
        onRefresh={onRefresh}
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
    fontSize: 14,
  },
  separator: {
    height: 12,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 12,
    color: '#555',
  },
});