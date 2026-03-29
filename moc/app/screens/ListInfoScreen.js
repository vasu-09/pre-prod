// ListInfoScreen.js
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useChatRegistry } from '../context/ChatContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import apiClient from '../services/apiClient';
import { getStoredSession } from '../services/authStorage';
import { getAllContactsFromDb } from '../services/contactStorage';
import {
  getListSummaryFromDb,
  initializeDatabase,
  saveListSummaryToDb,
} from '../services/database';
import {
  enqueueListMutation,
  flushListMutationQueue,
  isProbablyOfflineError,
} from '../services/listMutationQueue';
import { createDirectRoom } from '../services/roomsService';
import { getStringParam, safeJsonParseParam } from '../utils/navigationParams';

export default function ListInfoScreen() {
  const router = useRouter();
  const { rooms, upsertRoom } = useChatRegistry();
  const { isOnline } = useNetworkStatus();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const listName = getStringParam(params?.listName, '');
  const description = getStringParam(params?.description, '');

  const memberArr = useMemo(() => {
    const parsedMembers = safeJsonParseParam(params?.members, [], 'list members');
    return Array.isArray(parsedMembers) ? parsedMembers : [];
  }, [params?.members]);

  const listId = useMemo(() => {
    const resolved = getStringParam(params?.listId, '');
    return resolved || null;
  }, [params?.listId]);

  const [recipients, setRecipients] = useState(memberArr);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [listTitle, setListTitle] = useState(listName ?? '');
  const [listDescription, setListDescription] = useState(description ?? '');
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  const existingRecipientIdsParam = useMemo(
    () =>
      JSON.stringify(
        (recipients ?? [])
          .map((recipient) => String(recipient?.id ?? ''))
          .filter(Boolean),
      ),
    [recipients],
  );

  const getAvatarUri = (value) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

  const persistRecipients = useCallback(
    async (nextRecipients) => {
      if (!listId) return;

      await initializeDatabase();
      await saveListSummaryToDb({
        id: String(listId),
        title: listTitle || 'Untitled List',
        description: listDescription ?? null,
        members: nextRecipients,
      });
    },
    [listDescription, listId, listTitle],
  );

  useEffect(() => {
    setListTitle(listName ?? '');
  }, [listName]);

  useEffect(() => {
    setListDescription(description ?? '');
  }, [description]);

   const loadCachedInfo = useCallback(async () => {
    if (!listId) return;

    try {
      await initializeDatabase();
      const cached = await getListSummaryFromDb(String(listId));
      if (!cached) return;

      if (cached.title) setListTitle(cached.title);
      if (cached.description) setListDescription(cached.description);
      if (Array.isArray(cached.members) && cached.members.length) {
        setRecipients(cached.members);
      }
      } catch (dbError) {
      console.error('Failed to load cached list info', dbError);
    }
  }, [listId]);

 const refreshRecipientsFromServer = useCallback(async () => {
    if (!listId) {
      setErrorMessage('Missing list identifier.');
      setRecipients(memberArr);
      return;
    }

    if (!isOnline) {
      setStatusMessage('');
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

      const recipientIds = Array.isArray(data?.recipientUserIds)
        ? data.recipientUserIds
        : [];

      const contacts = await getAllContactsFromDb();

      const normalizedRecipients = recipientIds.map((recipientId) => {
        const matchedContact = contacts.find(
          (contact) => String(contact.matchUserId) === String(recipientId),
        );

         return {
          id: String(recipientId),
          name: matchedContact?.name ?? `User ${recipientId}`,
          img: getAvatarUri(matchedContact?.imageUri),
          phone: matchedContact?.matchPhone ?? null,
        };
      });

      setRecipients(normalizedRecipients);

      if (!normalizedRecipients.length) {
        setErrorMessage('No recipients yet.');
      }

      await persistRecipients(normalizedRecipients);
      setStatusMessage('');
    } catch (error) {
      console.error('Failed to load recipients', error);
      setErrorMessage('Showing saved recipients. Live refresh failed.');
      setRecipients((prev) => (prev?.length ? prev : memberArr));
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, listId, listTitle, memberArr, persistRecipients]);

  const syncWhenOnline = useCallback(async () => {
    if (!isOnline) {
      setStatusMessage('');
      return;
    }

    try {
      const result = await flushListMutationQueue();
      if (result.processed > 0) {
        setStatusMessage(
          `Synced ${result.processed} offline change${result.processed === 1 ? '' : 's'}.`,
        );
      }
      await refreshRecipientsFromServer();
    } catch (error) {
      console.warn('Failed to flush pending changes before recipient refresh', error);
    }
  }, [isOnline, refreshRecipientsFromServer]);

  useFocusEffect(
    useCallback(() => {
      void loadCachedInfo();
      void syncWhenOnline();
    }, [loadCachedInfo, syncWhenOnline]),
  );

  useEffect(() => {
    if (isOnline) {
      void syncWhenOnline();
    } else {
      setStatusMessage('');
    }
  }, [isOnline, syncWhenOnline]);

  const handleOpenAddRecipients = useCallback(() => {
    router.push({
      pathname: '/screens/AddListRecipientsScreen',
      params: {
        listId: String(listId ?? ''),
        listTitle: String(listTitle ?? ''),
        existingRecipientIds: existingRecipientIdsParam,
      },
    });
  }, [existingRecipientIdsParam, listId, listTitle, router]);

  const closeActionMenu = useCallback(() => {
    setActionMenuVisible(false);
    setSelectedRecipient(null);
  }, []);

  const closeRemoveConfirmation = useCallback(() => {
    if (isRemoving) return;
    setRemoveConfirmVisible(false);
  }, [isRemoving]);

  const handleOpenRecipientActions = useCallback((recipient) => {
    setSelectedRecipient(recipient);
    setActionMenuVisible(true);
  }, []);

  const handleViewRecipient = useCallback(() => {
    if (!selectedRecipient) {
      closeActionMenu();
      return;
    }

    const routeParams = {
      name: selectedRecipient.name ?? 'Unknown contact',
      image: getAvatarUri(selectedRecipient?.img) ?? '',
      phone: selectedRecipient.phone ?? '',
      media: JSON.stringify([]),
    };

    closeActionMenu();

    router.push({
      pathname: '/screens/ContactProfileScreen',
      params: routeParams,
    });
  }, [closeActionMenu, router, selectedRecipient]);

  const handleMessageRecipient = useCallback(async () => {
    if (!selectedRecipient) {
      closeActionMenu();
      return;
    }

    const participantId = Number(selectedRecipient.id);
    if (!Number.isInteger(participantId) || participantId <= 0) {
      closeActionMenu();
      Alert.alert('Unable to start chat', 'This recipient does not have a valid MoC account.');
      return;
    }

    const roomTitle = selectedRecipient.name ?? selectedRecipient.phone ?? 'Chat';
    const roomAvatar = getAvatarUri(selectedRecipient?.img);
    const recipientPhone = selectedRecipient.phone ? String(selectedRecipient.phone) : '';

    const existingRoom = rooms.find(
      (room) => Number(room?.peerId) === participantId,
    );

    if (existingRoom) {
      closeActionMenu();
      router.push({
        pathname: '/screens/ChatDetailScreen',
        params: {
          roomId: String(existingRoom.id),
          roomKey: existingRoom.roomKey,
          title: existingRoom.title ?? roomTitle,
          peerId: String(existingRoom.peerId ?? participantId),
          phone: existingRoom.peerPhone ?? recipientPhone,
          image: existingRoom.avatar ?? roomAvatar ?? undefined,
        },
      });
      return;
    }

    if (!isOnline) {
      closeActionMenu();
      Alert.alert(
        'Offline',
        'You can open existing chats offline, but you cannot create a new chat right now.',
      );
      return;
    }

    try {
      setIsOpeningChat(true);

      const room = await createDirectRoom(participantId);

      upsertRoom({
        id: room.id,
        roomKey: room.roomId,
        title: roomTitle,
        avatar: roomAvatar,
        peerId: participantId,
        peerPhone: recipientPhone || null,
      });

      closeActionMenu();

      router.push({
        pathname: '/screens/ChatDetailScreen',
        params: {
          roomId: String(room.id),
          roomKey: room.roomId,
          title: roomTitle,
          peerId: String(participantId),
          phone: recipientPhone,
          image: roomAvatar ?? undefined,
        },
      });
    } catch (error) {
      console.warn('Unable to start direct chat from list info', error);
      Alert.alert('Unable to start chat', 'Please try again in a moment.');
    } finally {
      setIsOpeningChat(false);
    }
  }, [closeActionMenu, isOnline, rooms, router, selectedRecipient, upsertRoom]);

  const handlePromptRemoveRecipient = useCallback(() => {
    if (!selectedRecipient) {
      closeActionMenu();
      return;
    }

    setActionMenuVisible(false);
    setRemoveConfirmVisible(true);
  }, [closeActionMenu, selectedRecipient]);

  const handleRemoveRecipient = useCallback(async () => {
    if (!selectedRecipient) {
      setRemoveConfirmVisible(false);
      return;
    }

    const phoneNumber = selectedRecipient.phone
      ? String(selectedRecipient.phone).trim()
      : '';

    if (!phoneNumber) {
      setRemoveConfirmVisible(false);
      setSelectedRecipient(null);
      Alert.alert('Unable to remove recipient', 'This recipient is missing a phone number.');
      return;
    }

    if (!listId) {
      setRemoveConfirmVisible(false);
      setSelectedRecipient(null);
      Alert.alert('Unable to remove recipient', 'Missing list identifier.');
      return;
    }

    const nextRecipients = recipients.filter((recipient) => {
      const samePhone =
        String(recipient?.phone ?? '').trim() === phoneNumber;
      const sameId =
        String(recipient?.id ?? '') === String(selectedRecipient?.id ?? '');
      return !(samePhone || sameId);
    });

    setRecipients(nextRecipients);
    setRemoveConfirmVisible(false);
    setSelectedRecipient(null);

    try {
      await persistRecipients(nextRecipients);
    } catch (error) {
      console.error('Failed to persist recipient removal locally', error);
    }

    if (!isOnline) {
      await enqueueListMutation({
        type: 'remove-recipient',
        payload: {
          listId: String(listId),
          phone: phoneNumber,
        },
      });
      setStatusMessage('Recipient removed locally. It will sync when online.');
      return;
    }

    try {
      setIsRemoving(true);

      const session = await getStoredSession();
      const userId = session?.userId ? String(session.userId) : null;

      if (!userId) {
        throw new Error('Missing account information. Please sign in again.');
      }

      await apiClient.delete(
        `/api/lists/${encodeURIComponent(String(listId))}/recipients-by-phone`,
        {
          headers: { 'X-User-Id': userId },
          data: phoneNumber,
        },
      );

      setStatusMessage('');
    } catch (error) {
      console.error('Failed to remove recipient from list', error);
      
      if (isProbablyOfflineError(error)) {
        await enqueueListMutation({
          type: 'remove-recipient',
          payload: {
            listId: String(listId),
            phone: phoneNumber,
          },
        });
        setStatusMessage('Recipient removed locally. It will sync when online.');
        return;
      }

      Alert.alert(
        'Unable to remove recipient',
        'Recipient was removed locally, but server sync failed.',
      );
    } finally {
      setIsRemoving(false);
    }
  }, [isOnline, listId, persistRecipients, recipients, selectedRecipient]);

  const renderMember = ({ item }) => {
    const avatarUri = getAvatarUri(item.img);
     return (
      <TouchableOpacity
        style={styles.memberRow}
        activeOpacity={1}
        onLongPress={() => handleOpenRecipientActions(item)}
        delayLongPress={220}
      >
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
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
      </TouchableOpacity>
    );
  };

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

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{listTitle}</Text>
        <TouchableOpacity onPress={handleOpenAddRecipients} style={styles.iconBtn}>
          <Icon name="person-add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {statusMessage ? (
        <View style={styles.statusBanner}>
          <Text style={styles.statusBannerText}>{statusMessage}</Text>
        </View>
      ) : null}

        <View style={styles.content}>
        <View style={[styles.card, styles.sectionContainer]}>
          <Text style={styles.title}>Description</Text>
          {listDescription ? (
            <Text style={styles.description}>{listDescription}</Text>
          ) : null}
        </View>

        <View style={[styles.card, styles.sectionContainer]}>
          <Text style={styles.section}>Shared With</Text>
          <FlatList
            data={recipients}
            keyExtractor={(item, index) => String(item?.id ?? index)}
            renderItem={renderMember}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
            ListEmptyComponent={renderEmpty}
          />
        </View>

      </View>

      <Modal
        visible={actionMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeActionMenu}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeActionMenu}>
          <Pressable style={styles.actionMenuCard} onPress={() => {}}>
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={handleViewRecipient}
            >
              <Text style={styles.actionMenuText}>
                View {selectedRecipient?.name ?? 'contact'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={handleMessageRecipient}
              disabled={isOpeningChat}
            >
              <Text style={styles.actionMenuText}>
                {isOpeningChat
                  ? 'Opening chat…'
                  : `Message ${selectedRecipient?.name ?? 'contact'}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={handlePromptRemoveRecipient}
            >
              <Text style={[styles.actionMenuText, styles.removeActionText]}>
                Remove {selectedRecipient?.name ?? 'contact'}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={removeConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRemoveConfirmation}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeRemoveConfirmation}>
          <Pressable style={styles.confirmCard} onPress={() => {}}>
            <Text style={styles.confirmText}>
              Remove {selectedRecipient?.name ?? 'this recipient'} from{' '}
              {listTitle || 'this list'}?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmCancel]}
                onPress={closeRemoveConfirmation}
                disabled={isRemoving}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmOk]}
                onPress={handleRemoveRecipient}
                disabled={isRemoving}
              >
                {isRemoving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmOkText}>OK</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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

  statusBanner: {
    backgroundColor: '#eaf3fb',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusBannerText: {
    color: '#1f6ea7',
    fontSize: 13,
    fontWeight: '500',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  actionMenuCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 4,
    elevation: 6,
  },
  actionMenuItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionMenuText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  removeActionText: {
    color: '#b3261e',
  },
  confirmCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 6,
  },
  confirmText: {
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 16,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  confirmButton: {
    minWidth: 84,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  confirmCancel: {
    backgroundColor: '#eceff1',
  },
  confirmCancelText: {
    color: '#1f6ea7',
    fontWeight: '600',
  },
  confirmOk: {
    backgroundColor: '#1f6ea7',
  },
  confirmOkText: {
    color: '#fff',
    fontWeight: '600',
  },
});
