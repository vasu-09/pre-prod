import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../services/apiClient';
import { getStoredSession } from '../services/authStorage';
import { getAllContactsFromDb } from '../services/contactStorage';

const normalizeId = (value) => String(value ?? '').trim();

const parseExistingRecipientIds = (rawParam) => {
  if (!rawParam) {
    return new Set();
  }

  const paramValue = Array.isArray(rawParam) ? rawParam[0] : rawParam;

  try {
    const parsed = JSON.parse(paramValue);
    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(parsed.map(normalizeId).filter(Boolean));
  } catch (error) {
    console.warn('Unable to parse existing recipient ids param', error);
    return new Set();
  }
};

const normalizeCandidates = (contacts, existingIds) => {
  const uniqueByUserId = new Map();

  (contacts ?? []).forEach((contact) => {
    const userId = normalizeId(contact?.matchUserId);

    if (!userId || existingIds.has(userId) || uniqueByUserId.has(userId)) {
      return;
    }

    uniqueByUserId.set(userId, {
      id: userId,
      localContactId: contact?.id ? String(contact.id) : null,
      name: contact?.name ? String(contact.name) : `User ${userId}`,
      img: contact?.imageUri ?? null,
      phone: contact?.matchPhone ?? contact?.phoneNumbers?.[0]?.number ?? null,
    });
  });

  return Array.from(uniqueByUserId.values()).sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  );
};

export default function AddListRecipientsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { listId: rawListId, listTitle: rawListTitle, existingRecipientIds: rawExistingRecipientIds } =
    useLocalSearchParams();

  const listId = useMemo(() => normalizeId(Array.isArray(rawListId) ? rawListId[0] : rawListId), [rawListId]);
  const listTitle = useMemo(
    () => String(Array.isArray(rawListTitle) ? rawListTitle[0] : rawListTitle ?? 'List'),
    [rawListTitle],
  );

  const existingIds = useMemo(() => parseExistingRecipientIds(rawExistingRecipientIds), [rawExistingRecipientIds]);

  const [allCandidates, setAllCandidates] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadCandidates = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const contacts = await getAllContactsFromDb();
        const normalized = normalizeCandidates(contacts, existingIds);

        if (isMounted) {
          setAllCandidates(normalized);
          if (!normalized.length) {
            setErrorMessage('No eligible contacts available to add.');
          }
        }
      } catch (error) {
        console.error('Failed to load contact candidates', error);
        if (isMounted) {
          setErrorMessage('Unable to load contacts right now.');
          setAllCandidates([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadCandidates();

    return () => {
      isMounted = false;
    };
  }, [existingIds]);

  const filteredCandidates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return allCandidates;
    }

    return allCandidates.filter((candidate) => {
      const name = String(candidate?.name ?? '').toLowerCase();
      const phone = String(candidate?.phone ?? '').toLowerCase();
      return name.includes(query) || phone.includes(query);
    });
  }, [allCandidates, searchQuery]);

  const selectedContacts = useMemo(
    () => allCandidates.filter((candidate) => selectedIds.includes(candidate.id)),
    [allCandidates, selectedIds],
  );

  const toggleSelect = (userId) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSubmit = async () => {
    if (!listId || isSubmitting) {
      return;
    }

    if (!selectedIds.length) {
      Alert.alert('Select recipients', 'Choose at least one recipient to continue.');
      return;
    }

    const selectedNumbers = Array.from(
      new Set(
        selectedContacts
          .map((contact) => String(contact.phone ?? '').trim())
          .filter(Boolean),
      ),
    );

    if (!selectedNumbers.length) {
      Alert.alert('Unable to add recipients', 'Selected contacts are missing phone details.');
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await getStoredSession();
      const userId = session?.userId ? String(session.userId) : null;

      await apiClient.post(
        `/api/lists/${encodeURIComponent(listId)}/recipients`,
        { phoneNumbers: selectedNumbers },
        { headers: userId ? { 'X-User-Id': userId } : undefined },
      );

      Alert.alert('Recipients added', 'The selected recipients were added successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to add list recipients', error);
      Alert.alert('Unable to add recipients', 'Something went wrong while adding recipients. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCandidate = ({ item }) => {
    const isSelected = selectedIds.includes(item.id);

    return (
      <TouchableOpacity
        style={[styles.contactRow, isSelected && styles.selectedRow]}
        onPress={() => toggleSelect(item.id)}
      >
        {item.img ? (
          <Image source={{ uri: item.img }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholderAvatar]}>
            <Icon name="person" size={20} color="#888" />
          </View>
        )}
        <View style={styles.contactMeta}>
          <Text style={styles.contactName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.phone ? (
            <Text style={styles.contactPhone} numberOfLines={1}>
              {item.phone}
            </Text>
          ) : null}
        </View>
        {isSelected ? <Icon name="check-circle" size={24} color="#1f6ea7" /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1f6ea7" barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top }]}> 
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Add recipients</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{listTitle}</Text>
        </View>
      </View>

      {!listId ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Missing list identifier. Please go back and try again.</Text>
        </View>
      ) : null}

      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#777" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts"
          value={searchQuery}
          onChangeText={setSearchQuery}
          editable={!isSubmitting}
        />
      </View>

      {selectedContacts.length ? (
        <View style={styles.selectedWrapper}>
          <Text style={styles.sectionTitle}>Selected ({selectedContacts.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedContent}>
            {selectedContacts.map((item) => (
              <TouchableOpacity key={item.id} onPress={() => toggleSelect(item.id)} style={styles.selectedItem}>
                {item.img ? (
                  <Image source={{ uri: item.img }} style={styles.selectedAvatar} />
                ) : (
                  <View style={[styles.selectedAvatar, styles.placeholderAvatar]}>
                    <Icon name="person" size={18} color="#888" />
                  </View>
                )}
                <Text style={styles.selectedName} numberOfLines={1}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Eligible contacts</Text>
      <FlatList
        data={filteredCandidates}
        keyExtractor={(item) => item.id}
        renderItem={renderCandidate}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {isLoading ? (
              <>
                <ActivityIndicator size="small" color="#1f6ea7" />
                <Text style={styles.emptyText}>Loading contacts…</Text>
              </>
            ) : (
              <Text style={styles.emptyText}>{errorMessage || 'No contacts found.'}</Text>
            )}
          </View>
        }
      />

      <TouchableOpacity
        style={[
          styles.fab,
          { bottom: insets.bottom + 16 },
          (!selectedIds.length || !listId || isSubmitting) && styles.fabDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!selectedIds.length || !listId || isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Icon name="person-add" size={24} color="#fff" />
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef5fa' },
  header: {
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  iconBtn: { padding: 8 },
  headerTitleWrap: { flex: 1, marginLeft: 8 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: '#d7e7f3', fontSize: 13, marginTop: 2 },
  errorContainer: { paddingHorizontal: 12, paddingVertical: 8 },
  errorText: { color: '#a10000', fontSize: 13 },
  searchContainer: {
    margin: 12,
    marginBottom: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, paddingVertical: 10, color: '#333' },
  sectionTitle: { marginHorizontal: 12, marginTop: 10, marginBottom: 6, fontWeight: '600', color: '#333' },
  selectedWrapper: { backgroundColor: '#f5f9ff', paddingVertical: 8 },
  selectedContent: { paddingHorizontal: 8 },
  selectedItem: { width: 64, alignItems: 'center', marginRight: 12 },
  selectedAvatar: { width: 48, height: 48, borderRadius: 24, marginBottom: 4 },
  selectedName: { fontSize: 11, color: '#333', textAlign: 'center' },
  contactRow: {
    backgroundColor: '#fff',
    marginHorizontal: 10,
    marginBottom: 6,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedRow: {
    borderWidth: 1,
    borderColor: '#1f6ea7',
  },
  avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  placeholderAvatar: { backgroundColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
  contactMeta: { flex: 1 },
  contactName: { fontSize: 16, color: '#333' },
  contactPhone: { fontSize: 12, color: '#777', marginTop: 2 },
  emptyContainer: { paddingVertical: 30, alignItems: 'center' },
  emptyText: { color: '#666', marginTop: 8 },
  fab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1f6ea7',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  fabDisabled: { opacity: 0.45 },
});