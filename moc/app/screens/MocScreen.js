import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useChatRegistry } from '../context/ChatContext';
import { useContactSync } from '../hooks/useContactSync';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { getStoredSession } from '../services/authStorage';
import { enqueuePendingRoomCreate, flushPendingRoomCreates } from '../services/chatRoomMutationQueue';
import { ensureContactsSynced, searchCachedContacts } from '../services/contactSyncCoordinator';
import { getE2EEClient } from '../services/e2ee';
import { flushListMutationQueue } from '../services/listMutationQueue';
import { createDirectRoom, createLocalDirectRoom } from '../services/roomsService';

const windowHeight = Dimensions.get('window').height;

const MocScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const Tab = createMaterialTopTabNavigator();
  const { rooms, upsertRoom } = useChatRegistry();
  const { isOnline } = useNetworkStatus();

  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contactResults, setContactResults] = useState([]);
  const [contactsError, setContactsError] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [createError, setCreateError] = useState('');
  const [creatingRoomFor, setCreatingRoomFor] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const hideMenu = () => setMenuVisible(false);
  const topBarHeight = 50 + insets.top;
  const hasSearchQuery = searchQuery.trim().length > 0;

  const {
    contacts: matchedSuggestions,
    isLoading: isLoadingMatchedSuggestions,
    error: matchedSuggestionsError,
    permissionDenied: isPermissionDeniedForSuggestions,
    refresh: refreshMatchedSuggestions,
  } = useContactSync({
    selector: 'matched',
    refreshOnMount: false,
    staleMs: 5 * 60 * 1000,
  });

  const getAvatarUri = useCallback((contact) => {
    if (typeof contact?.imageUri !== 'string') {
      return null;
    }

    const trimmed = contact.imageUri.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, []);

  const openRoom = useCallback(
    (room, fallbackTitle, fallbackPhone, fallbackImage, fallbackPeerId) => {
      router.push({
        pathname: '/screens/ChatDetailScreen',
        params: {
          roomId: String(room.id),
          roomKey: room.roomKey,
          title: room.title ?? fallbackTitle,
          peerId:
            room.peerId != null
              ? String(room.peerId)
              : fallbackPeerId != null
                ? String(fallbackPeerId)
                : undefined,
          phone: room.peerPhone ?? fallbackPhone ?? undefined,
          image: room.avatar ?? fallbackImage ?? undefined,
        },
      });
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrapOnlineWork = async () => {
      if (!isOnline) {
        setStatusMessage('');
        return;
      }

      try {
        await Promise.all([
          refreshMatchedSuggestions(false),
          flushPendingRoomCreates(),
          flushListMutationQueue(),
          getE2EEClient().catch((err) => {
            console.warn('Failed to bootstrap E2EE client', err);
          }),
        ]);

        if (!cancelled) {
          setStatusMessage('');
        }
      } catch (error) {
        console.warn('Failed online bootstrap for MocScreen', error);
        if (!cancelled) {
          setStatusMessage('Showing saved data. Background sync could not complete.');
        }
      }
    };

    void bootstrapOnlineWork();

    return () => {
      cancelled = true;
    };
  }, [isOnline, refreshMatchedSuggestions]);

  useEffect(() => {
    if (!searchActive) {
      return;
  }

    let mounted = true;
    const trimmed = searchQuery.trim();

    if (!trimmed) {
      setContactResults([]);
      setContactsError('');
      return () => {
        mounted = false;
      };
    }

    searchCachedContacts(trimmed)
      .then((results) => {
        if (mounted) {
          setContactResults(results);
          setContactsError('');
        }
      })
      .catch((error) => {
        console.warn('Unable to search cached contacts', error);
        if (mounted) {
          setContactsError('Unable to search saved contacts right now.');
        }
      });

  return () => {
      mounted = false;
    };
  }, [searchActive, searchQuery]);

  useEffect(() => {
    if (!searchActive || !isOnline) {
      return;
    }

    let cancelled = false;

    const refreshContactCache = async () => {
      const result = await ensureContactsSynced({
        force: false,
        staleMs: 5 * 60 * 1000,
      });

      if (cancelled) return;

      if (result.error) {
        setStatusMessage('Using saved contacts. Live refresh failed.');
    }

    if (searchQuery.trim()) {
        try {
          const refreshed = await searchCachedContacts(searchQuery.trim());
          if (!cancelled) {
            setContactResults(refreshed);
          }
        } catch (error) {
          console.warn('Unable to refresh searched contacts after sync', error);
        }
      }
    };

    void refreshContactCache();

    return () => {
      cancelled = true;
    };
  }, [searchActive, isOnline, searchQuery]);

  const handleInvite = useCallback(async (contact) => {
    const displayName = contact?.name?.trim();
    const inviteMessage = displayName
      ? `Hey ${displayName}, I'm using MoC to stay connected. Download the app and join me!`
      : "I'm using MoC to stay connected. Download the app and join me!";

    try {
      await Share.share({ message: inviteMessage });
    } catch (err) {
      console.warn('Unable to open invite share sheet', err);
    }
  }, []);

  const renderAvatar = useCallback(
    (contact) => {
      const avatarUri = getAvatarUri(contact);

    if (avatarUri) {
      return <Image source={{ uri: avatarUri }} style={styles.contactAvatar} />;
    }

  return (
        <View style={[styles.contactAvatar, styles.avatarPlaceholder]}>
          <Icon name="person" size={24} color="#888" />
        </View>
      );
    },
    [getAvatarUri],
  );

  const handleStartDirectChat = useCallback(
    async (contact) => {
      const participantId = Number(contact?.matchUserId);

       if (!Number.isInteger(participantId) || participantId <= 0) {
        setCreateError('Contact is missing a valid MoC account.');
        return;
      }

      setCreateError('');

      const roomTitle = contact?.name || contact?.matchPhone || 'Chat';
      const roomAvatar = getAvatarUri(contact);
      const tracker = contact?.id ?? contact?.matchPhone ?? String(participantId);
      const phone = contact?.matchPhone ?? contact?.phoneNumbers?.[0]?.number ?? null;

      const existingRoom = rooms.find((room) => Number(room?.peerId) === participantId);

      if (existingRoom) {
        openRoom(existingRoom, roomTitle, phone, roomAvatar, participantId);
        return;
      }

      try {
        if (!isOnline) {
          const session = await getStoredSession();
          const currentUserId = session?.userId ? Number(session.userId) : null;

          if (!currentUserId) {
            throw new Error('Missing current user id for local room creation');
          }

          const localRoom = await createLocalDirectRoom({
            currentUserId,
            participantId,
            title: roomTitle,
            avatar: roomAvatar,
            peerPhone: phone,
          });

          const normalizedRoom = {
            id: localRoom.id,
            roomKey: localRoom.roomId,
            title: roomTitle,
            avatar: roomAvatar,
            peerId: participantId,
            peerPhone: phone,
            unreadCount: 0,
          };

          upsertRoom(normalizedRoom);

          await enqueuePendingRoomCreate({
            localRoomId: localRoom.id,
            localRoomKey: localRoom.roomId,
            participantId,
            title: roomTitle,
            avatar: roomAvatar,
            peerPhone: phone,
          });

          openRoom(normalizedRoom, roomTitle, phone, roomAvatar, participantId);
          return;
        }

        setCreatingRoomFor(tracker);

        const room = await createDirectRoom(participantId);

        const normalizedRoom = {
          id: room.id,
          roomKey: room.roomId,
          title: roomTitle,
          avatar: roomAvatar,
          peerId: participantId,
          peerPhone: phone,
        };

        upsertRoom(normalizedRoom);
        openRoom(normalizedRoom, roomTitle, phone, roomAvatar, participantId);
      } catch (err) {
        console.warn('Unable to start direct chat', err);
        setCreateError('Unable to start a conversation right now.');
      } finally {
        setCreatingRoomFor(null);
      }
    },
    [getAvatarUri, isOnline, openRoom, rooms, upsertRoom],
  );

  const SearchResults = ({ contactResults: results, onInvite }) => {
    const matchedContacts = (results ?? []).filter((contact) => contact?.matchUserId);
    const inviteContacts = (results ?? []).filter((contact) => !contact?.matchUserId);

    if (!matchedContacts.length && !inviteContacts.length) {
      return <Text style={styles.emptyState}>No contacts found.</Text>;
    }

    const renderContactRow = (contact, index) => {
      const fallbackName = contact?.name || 'Unknown contact';
      const phoneDisplay = contact?.matchPhone || contact?.phoneNumbers?.[0]?.number;
      const tracker = contact?.id ?? contact?.matchPhone ?? `contact-${index}`;
      const isCreating = tracker === creatingRoomFor;

      return (
        <TouchableOpacity
          key={tracker}
          style={styles.contactResultRow}
          disabled={isCreating}
          onPress={() => handleStartDirectChat(contact)}
        >
          {renderAvatar(contact)}
          <View style={styles.contactResultText}>
            <Text style={styles.contactName}>{fallbackName}</Text>
            {phoneDisplay ? <Text style={styles.contactPhone}>{phoneDisplay}</Text> : null}
          </View>
          {isCreating ? <ActivityIndicator size="small" color="#1f6ea7" /> : null}
        </TouchableOpacity>
      );
    };

    const renderInviteRow = (contact, index) => {
      const fallbackName = contact?.name || 'Unknown contact';
      const phoneDisplay = contact?.phoneNumbers?.[0]?.number;

      return (
        <View
          key={contact?.id ?? contact?.matchPhone ?? `invite-${index}`}
          style={[styles.contactResultRow, styles.inviteRow]}
        >
          {renderAvatar(contact)}
          <View style={styles.contactResultText}>
            <Text style={styles.contactName}>{fallbackName}</Text>
            {phoneDisplay ? <Text style={styles.contactPhone}>{phoneDisplay}</Text> : null}
          </View>

          <TouchableOpacity style={styles.inviteBadge} onPress={() => onInvite?.(contact)}>
            <Text style={styles.inviteBadgeText}>Invite</Text>
          </TouchableOpacity>
        </View>
      );
    };

    return (
      <>
        {matchedContacts.length ? (
          <>
            <Text style={styles.resultGroupLabel}>On MoC</Text>
            {matchedContacts.map(renderContactRow)}
          </>
        ) : null}

        {inviteContacts.length ? (
          <>
            <Text style={[styles.resultGroupLabel, styles.inviteLabel]}>Invite to MoC</Text>
            {inviteContacts.map(renderInviteRow)}
          </>
        ) : null}
      </>
    );
  };

  const onMenuSelect = (action) => {
    hideMenu();
    switch (action) {
      case 'new-group':
        // TODO
        return;
      case 'new-contact':
        // TODO
        return;
      case 'create-list':
        router.push('/screens/ListsScreen');
        return;
      case 'settings':
        return router.push('/screens/SettingsScreen');
      default:
        return;
    }
  };

  const formatLastTime = useCallback((iso) => {
    if (!iso) return '';
    try {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, []);

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) {
      return rooms;
    }
    const q = searchQuery.trim().toLowerCase();
    return rooms.filter((room) => room.title?.toLowerCase().includes(q));
  }, [rooms, searchQuery]);
 
  const ChatsScreen = () => {
    const hasChats = rooms.length > 0;
    
    return (
      <View style={styles.chatsWrapper}>
        {!!statusMessage ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>{statusMessage}</Text>
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={
            hasChats
              ? [styles.chatListContainer, { paddingBottom: insets.bottom + 96 }]
              : { flexGrow: 1, paddingBottom: insets.bottom + 96 }
          }
        >
          {hasChats ? (
            filteredRooms.map((room) => {
              const lastMessage =
                room.lastMessage?.text ?? room.lastMessage?.plaintext ?? 'No messages yet';
              const time = formatLastTime(room.lastMessage?.at ?? room.lastMessage?.createdAt);

              const avatarUri =
                typeof room.avatar === 'string' && room.avatar.trim().length
                  ? room.avatar.trim()
                  : room.avatar;
                  
              const avatarSource = avatarUri ? { uri: avatarUri } : null;

              return (
                <TouchableOpacity
                  key={room.roomKey}
                  style={styles.chatItem}
                  onPress={() =>
                    openRoom(room, room.title, room.peerPhone, room.avatar, room.peerId)
                  }
                >
                  {avatarSource ? (
                    <Image source={avatarSource} style={styles.chatAvatar} />
                  ) : (
                    <View style={styles.chatAvatarPlaceholder}>
                      <Icon name="person" size={24} color="#7a7a7a" />
                    </View>
                  )}

                  <View style={styles.chatText}>
                    <Text style={styles.chatName}>{room.title}</Text>
                    <Text style={styles.chatLastMessage} numberOfLines={1}>
                      {lastMessage}
                    </Text>
                  </View>
                  <View style={styles.chatMeta}>
                    <Text style={styles.chatTime}>{time}</Text>
                    {room.unreadCount > 0 ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{room.unreadCount}</Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.centerContent}>
              <Text style={styles.title}>Start chatting</Text>
              <Text style={styles.subtitle}>
                Chat with your contacts or invite a friend to MoC.
              </Text>

              <View style={styles.inviteSection}>
                {isLoadingMatchedSuggestions ? (
                <Text style={styles.subtitle}>Loading saved MoC contacts…</Text>
                ) : null}

                {matchedSuggestionsError ? (
                  <Text style={styles.errorText}>{matchedSuggestionsError}</Text>
                ) : null}

                {isPermissionDeniedForSuggestions && !matchedSuggestions.length ? (
                  <Text style={styles.subtitle}>
                    Allow contacts access to discover friends on MoC.
                  </Text>
                ) : null}

                {!isLoadingMatchedSuggestions && !matchedSuggestions.length ? (
                  <Text style={styles.subtitle}>
                    {isOnline
                      ? 'No matched contacts on MoC yet.'
                      : 'No matched contacts are cached yet.'}
                  </Text>
                ) : null}

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.avatarRow}
                  contentContainerStyle={styles.avatarRowContent}
                >
                  {matchedSuggestions.map((contact, i) => (
                    <TouchableOpacity
                      style={styles.avatarContainer}
                      key={
                        contact?.matchUserId != null
                          ? String(contact.matchUserId)
                          : String(contact?.id ?? i)
                      }
                      onPress={() => handleStartDirectChat(contact)}
                    >
                      {getAvatarUri(contact) ? (
                        <Image source={{ uri: getAvatarUri(contact) }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                          <Icon name="person" size={22} color="#888" />
                        </View>
                      )}

                      <Text style={styles.avatarName} numberOfLines={1}>
                        {contact?.name || contact?.matchPhone || 'MoC user'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                
                <TouchableOpacity
                  style={styles.inviteButton}
                  onPress={() => router.push('/screens/InviteContactsScreen')}
                >
                  <Text style={styles.inviteText}>Invite a friend</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          </ScrollView>

      <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 16 }]}
          onPress={() => router.push('/screens/ListsScreen')}
        >
          <Icon name="playlist-add" size={20} color="#fff" />
          <Text style={styles.fabText}>create list</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Calls Screen
  const CallsScreen = () => (
    <View style={styles.callsContainer}>
      <Text style={styles.title}>Your call history will appear here</Text>
    </View>
  );

  const TopBar = () => (
    <View
      style={[
        styles.topBar,
        searchActive && styles.topBarSearch,
        { paddingTop: insets.top, minHeight: topBarHeight },
      ]}
    >
      {searchActive ? (
        <>
          <TouchableOpacity
            onPress={() => {
              setSearchActive(false);
              setSearchQuery('');
              setContactResults([]);
              setContactsError('');
              hideMenu();
            }}
          >
            <Icon name="arrow-back" size={22} color="#1f6ea7" />
          </TouchableOpacity>

          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </>
        ) : (
        <>
          <Text style={styles.appName}>MOC</Text>
          <View style={styles.iconGroup}>
            <TouchableOpacity
              onPress={() => {
                setSearchActive(true);
                setSearchQuery('');
                setContactsError('');
                hideMenu();
              }}
            >
              <Icon name="search" size={22} color="#fff" style={styles.icon} />
            </TouchableOpacity>

  <TouchableOpacity onPress={() => setMenuVisible((v) => !v)}>
              <Icon name="more-vert" size={22} color="#fff" style={styles.icon} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  const menuTop = topBarHeight;  
 
  return (
    <View style={{ flex: 1 }}>
      <StatusBar
        backgroundColor={searchActive ? '#fff' : '#1f6ea7'}
        barStyle={searchActive ? 'dark-content' : 'light-content'}
      />

      <TopBar />

      {menuVisible && !searchActive ? (
        <>
          <Pressable style={styles.menuOverlay} onPress={hideMenu} />
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={hideMenu} />
          <View style={[styles.menuContainer, { top: menuTop }]}>
            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuSelect('settings')}>
              <Text style={styles.menuLabel}>Settings</Text>
            </TouchableOpacity>
          </View>
        </>
       ) : null}
      

      {searchActive ? (
        <View style={styles.searchContainer}>
          {!isOnline ? (
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerText}>Offline — searching saved contacts only.</Text>
            </View>
          ) : null}

          {contactsError ? (
            <View style={styles.loaderWrapper}>
              <Text style={styles.errorText}>{contactsError}</Text>
            </View>
          ) : !hasSearchQuery ? (
            <View style={styles.loaderWrapper}>
              <Text style={styles.emptyState}>Start typing to search your contacts.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.searchResultsContent}>
              <Text style={styles.searchSectionLabel}>Contacts</Text>
              {createError ? <Text style={styles.errorText}>{createError}</Text> : null}

               <SearchResults contactResults={contactResults} onInvite={handleInvite} />
            </ScrollView>
          )}
        </View>
      ) : (
        <Tab.Navigator
          screenOptions={{
            tabBarStyle: { backgroundColor: '#1f6ea7', elevation: 0 },
            tabBarLabelStyle: { fontWeight: 'bold', fontSize: 14 },
            tabBarActiveTintColor: '#fff',
            tabBarInactiveTintColor: '#d4d4d4',
            tabBarIndicatorStyle: { backgroundColor: '#fff', height: 3 },
          }}
        >
          <Tab.Screen name="Chats" component={ChatsScreen} />
          <Tab.Screen name="Calls" component={CallsScreen} />
        </Tab.Navigator>
      )}
    </View>
  );
};

export default MocScreen;

const styles = StyleSheet.create({
  topBar: {
    minHeight: 50,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  topBarSearch: {
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
  },
  appName: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  iconGroup: { flexDirection: 'row' },
  icon: { marginLeft: 16 },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#000',
  },

  searchContainer: { flex: 1, backgroundColor: '#f6f6f6' },
  loaderWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loaderText: { marginTop: 12, color: '#1f6ea7', fontWeight: '600' },
  errorText: { color: '#c00', textAlign: 'center', fontWeight: '500' },
  searchResultsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchSectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1f6ea7',
  },
  contactResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
  },
  contactAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  avatarPlaceholder: {
    backgroundColor: '#e6e6e6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactResultText: { flex: 1 },
  contactName: { fontWeight: 'bold', fontSize: 16, color: '#111' },
  contactPhone: { color: '#555', marginTop: 2 },
  resultGroupLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f6ea7',
    marginTop: 4,
    marginBottom: 6,
  },
  inviteLabel: {
    marginTop: 16,
  },
  inviteRow: {
    alignItems: 'center',
  },
  inviteBadge: {
    borderWidth: 1,
    borderColor: '#1f6ea7',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  inviteBadgeText: {
    color: '#1f6ea7',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyState: {
    textAlign: 'center',
    marginTop: 16,
    color: '#777',
  },
  
  infoBanner: {
    backgroundColor: '#eaf3fb',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#c8dff3',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  infoBannerText: {
    color: '#1f6ea7',
    fontSize: 13,
    fontWeight: '500',
  },

  // Chats wrapper
  chatsWrapper: { flex: 1, backgroundColor: '#f6f6f6' },
  chatListContainer: { paddingVertical: 8 },

  // Empty-state center
  centerContent: {
    flex: 1,
    paddingTop: 150,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: windowHeight * 0.15,
  },

  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { textAlign: 'center', fontSize: 14, color: '#666', marginBottom: 24 },

  inviteSection: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  avatarRow: { flexDirection: 'row', marginBottom: 16 },
  avatarRowContent: {
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  avatarContainer: { alignItems: 'center', marginHorizontal: 10 },
  avatar: { width: 64, height: 64, borderRadius: 32, marginBottom: 4 },
  avatarName: { fontSize: 12, maxWidth: 70, textAlign: 'center' },

  inviteButton: {
    borderColor: '#1f6ea7',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 24,
    alignSelf: 'center',
  },
  inviteText: { color: '#1f6ea7', fontWeight: '600', fontSize: 14 },

  // Chat list items
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef5fa',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
  },
  chatAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  chatText: { flex: 1 },
  chatAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#e6e6e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatName: { fontWeight: 'bold', fontSize: 16, color: '#111' },
  chatLastMessage: { color: '#555', marginTop: 2, fontSize: 13 },
  chatTime: { fontSize: 12, color: '#777' },

   chatMeta: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  unreadBadge: {
    backgroundColor: '#1f6ea7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Floating action button
  fab: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 30,
    elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginLeft: 6 },

   callsContainer: {
    flex: 1,
    backgroundColor: '#f6f6f6',
    alignItems: 'center',
    justifyContent: 'center',
  },

   menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  menuContainer: {
    position: 'absolute',
    right: 16,
    width: 180,            // or '50%' as you prefer
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 5,
    zIndex: 1000,
    // no `top` here—it's injected via inline style
  },
 
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuLabel: {
    fontSize: 16,
    color: '#333',
  },
});
