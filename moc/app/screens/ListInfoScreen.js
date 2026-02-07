// ListInfoScreen.js
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { getStoredSession } from '../services/authStorage';
import { getAllContactsFromDb } from '../services/contactStorage';
import {
  getListSummaryFromDb,
  initializeDatabase,
  saveListSummaryToDb,
} from '../services/database';

export default function ListInfoScreen() {
  const router = useRouter();
  const { listName, description, members, listId: rawListId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const memberArr = useMemo(() => (members ? JSON.parse(members) : []), [members]);
  const listId = useMemo(() => {
    if (Array.isArray(rawListId)) {
      return rawListId[0];
    }
    return rawListId ?? null;
  }, [rawListId]);
  const [recipients, setRecipients] = useState(memberArr);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [listTitle, setListTitle] = useState(listName ?? '');
  const [listDescription, setListDescription] = useState(description ?? '');

  useEffect(() => {
    setListTitle(listName ?? '');
  }, [listName]);

  useEffect(() => {
    setListDescription(description ?? '');
  }, [description]);

  useEffect(() => {
    let isMounted = true;

    const loadCachedInfo = async () => {
      if (!listId) {
        return;
      }

      try {
        await initializeDatabase();
        const cached = await getListSummaryFromDb(String(listId));
        if (!isMounted || !cached) {
          return;
        }

        if (cached.title) {
          setListTitle(cached.title);
        }
        if (cached.description) {
          setListDescription(cached.description);
        }
        if (Array.isArray(cached.members) && cached.members.length) {
          setRecipients(cached.members);
        }
      } catch (dbError) {
        console.error('Failed to load cached list info', dbError);
      }
    };

    loadCachedInfo();

    return () => {
      isMounted = false;
    };
  }, [listId]);

  useEffect(() => {
    let isMounted = true;

    const fetchRecipients = async () => {
      if (!listId) {
        setErrorMessage('Missing list identifier.');
        setRecipients(memberArr);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        const session = await getStoredSession();
        const userId = session?.userId ? String(session.userId) : null;

        if (!userId) {
          setErrorMessage('Missing account information. Please sign in again.');
          setRecipients(memberArr);
          return;
        }

        const { data } = await apiClient.get(
          `/api/lists/${encodeURIComponent(listId)}/recipients`,
          { headers: { 'X-User-Id': userId } },
        );

        if (data?.title && !listTitle) {
          setListTitle(String(data.title));
        }

        const recipientIds = Array.isArray(data?.recipientUserIds) ? data.recipientUserIds : [];
        const contacts = await getAllContactsFromDb();

        const normalizedRecipients = recipientIds.map((recipientId) => {
          const matchedContact = contacts.find(
            (contact) => String(contact.matchUserId) === String(recipientId),
          );

          return {
            id: String(recipientId),
            name: matchedContact?.name ?? `User ${recipientId}`,
            img: matchedContact?.imageUri ?? null,
            phone: matchedContact?.matchPhone ?? null,
          };
        });

        if (isMounted) {
          setRecipients(normalizedRecipients);
          if (!normalizedRecipients.length) {
            setErrorMessage('No recipients yet.');
          }
        }

        try {
          await initializeDatabase();
          await saveListSummaryToDb({
            id: String(listId),
            title: data?.title ?? listTitle ?? 'Untitled List',
            description: data?.description ?? listDescription ?? null,
            members: normalizedRecipients,
          });
        } catch (dbError) {
          console.error('Failed to cache list recipients', dbError);
        }
      } catch (error) {
        console.error('Failed to load recipients', error);
        if (isMounted) {
          setErrorMessage('Unable to load recipients right now. Please try again later.');
          setRecipients(memberArr);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRecipients();

    return () => {
      isMounted = false;
    };
  }, [listId, memberArr]);

  const renderMember = ({ item }) => (
    <View style={styles.memberRow}>
      {item.img ? (
        <Image source={{ uri: item.img }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.placeholderAvatar]}>
          <Icon name="person" size={20} color="#888" />
        </View>
      )}
      <View style={styles.memberText}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {item.phone ? (
          <Text style={styles.subText} numberOfLines={1}>
            {item.phone}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      {isLoading ? (
        <>
          <ActivityIndicator size="small" color="#1f6ea7" />
          <Text style={styles.emptyText}>Loading recipients…</Text>
        </>
      ) : (
        <Text style={styles.emptyText}>{errorMessage || 'No recipients yet.'}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1f6ea7" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{listTitle}</Text>
        <TouchableOpacity onPress={() => {/* TODO: more menu */}} style={styles.iconBtn}>
                  <Icon name="person-add" size={24} color="#fff" />
                </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>

        {/* 1) Description Card */}
        
       <View style={[styles.card, styles.sectionContainer]}>
        <Text style={styles.title}>Description</Text>
           {listDescription ? (
            <Text style={styles.description}>{listDescription}</Text>
          ) : null}
        </View>

        {/* 2) Members Card */}
       <View style={[styles.card, styles.sectionContainer]}>
          <Text style={styles.section}>Shared With</Text>
          <FlatList
            data={recipients}
            keyExtractor={item => item.id}
            renderItem={renderMember}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
            ListEmptyComponent={renderEmpty}
          />
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' }, // light gray bg

  // Header
  header: {
    height: 56,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  iconBtn: { padding: 8 },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },


  // Content wrapper
  content: {
    paddingTop: 16,
    paddingBottom: 16,
    // no horizontal padding so cards can go edge-to-edge
  },
  // shared by both cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    // shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    // elevation for Android
    elevation: 3,
    alignSelf: 'stretch',
    marginHorizontal: 0,
  },
  sectionContainer: {
    marginBottom: 16,
  },

  // Title & Description inside first card
  title: { fontSize: 13, fontWeight: '400', marginBottom: 8 },
  description: { fontSize: 16, color: '#000' },

  // Section label inside members card
  section: { fontSize: 13, fontWeight: '400', marginBottom: 12 },

  // Member row styling
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  placeholderAvatar: {
    backgroundColor: '#f2f2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberText: { flex: 1 },
  name: { fontSize: 16, flexShrink: 1, color: '#333' },
  subText: { fontSize: 12, color: '#777', marginTop: 2 },
  emptyState: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { marginTop: 8, color: '#666', fontSize: 13 },
});
