// LinkListScreen.js
import * as Contacts from 'expo-contacts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../services/apiClient';
import { getAllContactsFromDb, saveContactsToDb } from '../services/contactStorage';

const initialSelected = [];

export default function LinkListScreen() {
  const insets = useSafeAreaInsets();
  const [selectedIds, setSelectedIds] = useState(initialSelected);
  const router = useRouter();
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { listName = '', items = '[]', listId: rawListId } = useLocalSearchParams();
  const parsedItems = JSON.parse(items);
  const listId = Array.isArray(rawListId) ? rawListId[0] : rawListId ?? '';

  useEffect(() => {
    let isMounted = true;

    const fetchContacts = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const permission = await Contacts.getPermissionsAsync();
        let status = permission.status;

        if (status !== 'granted') {
          const request = await Contacts.requestPermissionsAsync();
          status = request.status;
        }

        if (status !== 'granted') {
          if (isMounted) {
            setContacts([]);
            setErrorMessage('Allow contact access to find people already using MoC.');
          }
          return;
        }

        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
          sort: Contacts.SortTypes.FirstName,
        });

        // Persist and re-read from SQLite so this screen always reflects the DB.
        await saveContactsToDb(data);

        const storedContacts = await getAllContactsFromDb();

        if (!storedContacts.length) {
          if (isMounted) {
            setContacts([]);
            setErrorMessage('No contacts with phone numbers found on your device.');
          }
          return;
        }

        const matchedContacts = storedContacts
          .filter(contact => contact.matchUserId != null)
          .map(contact => ({
            id:
              contact.matchUserId != null
                ? String(contact.matchUserId)
                : contact.id ?? `contact-${Math.random().toString(36).slice(2)}`,
            userId: contact.matchUserId,
            phone: contact.matchPhone,
            name: contact.name || contact.matchPhone || 'Unknown contact',
            img: contact.imageUri ?? null,
          }))
          .filter((contact, index, arr) => arr.findIndex((c) => c.id === contact.id) === index);

        if (isMounted) {
          setContacts(matchedContacts);
          if (!matchedContacts.length) {
            setErrorMessage('None of your contacts are on MoC yet. Invite them to get started!');
          }
        }
      } catch (error) {
        console.error('Failed to load contacts from sync endpoint', error);
        if (isMounted) {
          setContacts([]);
          setErrorMessage('Unable to load contacts right now. Please try again later.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchContacts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setSelectedIds((prev) => {
      const filtered = prev.filter((id) => contacts.some((contact) => contact.id === id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [contacts]);

  const toggleSelect = id => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectedContacts = contacts.filter(c => selectedIds.includes(c.id));

  const handleSubmitRecipients = async () => {
    if (isSubmitting) {
      return;
    }

    if (!listId) {
      Alert.alert('Unable to share list', 'We could not find this list. Please go back and try again.');
      return;
    }

    const phoneNumbers = Array.from(
      new Set(
        selectedContacts
          .map(contact => String(contact.phone ?? '').trim())
          .filter(Boolean),
      ),
    );

    if (!phoneNumbers.length) {
      Alert.alert('Select at least one contact', 'Choose at least one contact to share this list with.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post(`/api/lists/${encodeURIComponent(listId)}/recipients`, { phoneNumbers });
      router.push({ pathname: '/screens/ListsScreen' });
    } catch (error) {
      console.error('Failed to add recipients', error);
      Alert.alert('Unable to share list', 'Something went wrong while adding recipients. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContactsEmpty = () => (
    <View style={styles.emptyContainer}>
      {isLoading ? (
        <>
          <ActivityIndicator size="small" color="#1f6ea7" />
          <Text style={styles.emptyText}>Syncing your contacts…</Text>
        </>
      ) : (
        <Text style={styles.emptyText}>{errorMessage || 'No contacts available.'}</Text>
      )}
    </View>
  );

  const renderSelectedAvatar = ({ item }) => (
    <View style={styles.avatarContainer}>
       {item.img ? (
        <Image source={{ uri: item.img }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.placeholderAvatarLarge]}>
          <Icon name="person" size={28} color="#888" />
        </View>
      )}
      <Text style={styles.avatarName} numberOfLines={1}>{item.name}</Text>
      <TouchableOpacity
        style={styles.removeIcon}
        onPress={() => toggleSelect(item.id)}
      >
        <Icon name="close" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderContact = ({ item }) => {
    const isSelected = selectedIds.includes(item.id);
    return (
      <TouchableOpacity
        style={[styles.contactRow, isSelected && styles.selectedRow]}
        onPress={() => toggleSelect(item.id)}
      >
        <View style={styles.avatarWrapper}>
           {item.img ? (
            <Image source={{ uri: item.img }} style={styles.avatarSmall} />
          ) : (
            <View style={[styles.avatarSmall, styles.placeholderAvatarSmall]}>
              <Icon name="person" size={20} color="#888" />
            </View>
          )}
          {isSelected && (
            <View style={styles.checkOverlay}>
              <Icon name="check" size={14} color="#fff" />
            </View>
          )}
        </View>
        <Text style={styles.contactName}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}> 
      <StatusBar backgroundColor="#1f6ea7" barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() =>router.push({
  pathname: '/screens/PreviewScreen',
  params: {
    listName: listName,
    items: JSON.stringify(parsedItems), // serialize full items array
  },
})} style={styles.iconBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Link the list</Text>
        <TouchableOpacity style={styles.iconBtn}>
          <Icon name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Text style={styles.countText}>{selectedIds.length} of {contacts.length} contacts</Text>
      <View style={styles.listInfo}>
        <Icon name="shopping-cart" size={32} color="#555" />
        <Text style={styles.listName}>{listName}</Text>
      </View>

      <Text style={styles.sectionTitle}>Selected contacts</Text>
      <FlatList
        data={selectedContacts}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={renderSelectedAvatar}
        contentContainerStyle={[styles.selectedList, { minHeight: 80 }]}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>
            select the contacts below that you want to share this list
          </Text>
        )}
      />

      <Text style={styles.sectionTitle}>All contacts</Text>
      <FlatList
        data={contacts}
        keyExtractor={item => item.id}
        renderItem={renderContact}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        ListEmptyComponent={renderContactsEmpty}
      />

      <TouchableOpacity
        style={[styles.sendFab, { bottom: insets.bottom + 16 }]}
        onPress={handleSubmitRecipients}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Icon name="check" size={24} color="#fff" />
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    height: 56,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  iconBtn: { padding: 8 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: 'bold' },

  countText: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    color: '#666',
    fontSize: 14,
  },
  listInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  listName: { marginLeft: 8, fontSize: 18, fontWeight: '600', color: '#333' },

  sectionTitle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedList: {
    paddingLeft: 12,
    paddingBottom: 24,
    justifyContent: 'center',
  },

  avatarContainer: {
    width: 72,
    alignItems: 'center',
    marginRight: 12,
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  placeholderAvatarLarge: {
    backgroundColor: '#e1e6eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarName: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
    color: '#333',
  },
  removeIcon: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ccc',
    borderRadius: 8,
    padding: 2,
  },

  emptyText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  selectedRow: {
    backgroundColor: '#eef5fa',
  },
  avatarWrapper: { position: 'relative' },
  avatarSmall: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  placeholderAvatarSmall: {
    backgroundColor: '#e1e6eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4b9941',
    borderRadius: 8,
    padding: 2,
  },
  contactName: { flex: 1, fontSize: 16, color: '#333' },

  sendFab: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#1f6ea7',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
