// ListsScreen.js
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../services/apiClient';
import { getStoredSession } from '../services/authStorage';
import {
  deleteListsFromDb,
  getListsFromDb,
  initializeDatabase,
  replaceListsInDb,
  updateListPinnedInDb,
} from '../services/database';

const HEADER_HEIGHT = 56;

const bgColors = ['#1f6ea7', '#64792A', '#E6A23C', '#67C23A', '#909399'];

export default function ListsScreen() {
  const router = useRouter();
  const [lists, setLists] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [pinnedIds, setPinnedIds] = useState(() => new Set());
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const getListId = useCallback(list => {
    if (!list) return null;
    const rawId = list?.id ?? list?.listId ?? null;
    return rawId != null ? String(rawId) : null;
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelection = useCallback(listId => {
    if (!listId) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  }, []);

   const applyLists = useCallback(
    sourceLists => {
      if (!isMountedRef.current) {
        return;
      }

      setLists(sourceLists);
      const nextPinned = new Set();
      sourceLists.forEach(list => {
        const id = getListId(list);
        const isPinnedFromSource = Boolean(list?.pinned ?? list?.isPinned);
        if (id && isPinnedFromSource) {
          nextPinned.add(id);
        }
      });
      setPinnedIds(nextPinned);
    },
    [getListId],
  );

  const loadListsFromDatabase = useCallback(async () => {
    try {
      await initializeDatabase();
      const storedLists = await getListsFromDb();
      if (Array.isArray(storedLists)) {
        applyLists(storedLists);
      }
    } catch (dbError) {
      console.error('Failed to load lists from database', dbError);
    }
  }, [applyLists]);


  const fetchLists = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeDatabase();
      const session = await getStoredSession();
      const userIdValue = session?.userId ? Number(session.userId) : null;

      if (!userIdValue) {
        if (isMountedRef.current) {
          setLists([]);
          setPinnedIds(new Set());
          setError('Please sign in again to load your lists.');
        }
        return;
      }

      const { data } = await apiClient.get('/api/lists/created', {
        headers: { 'X-User-Id': String(userIdValue) },
      });

      if (!isMountedRef.current) {
        return;
      }

      const receivedLists = Array.isArray(data) ? data : [];
      applyLists(receivedLists);

      const listsForStorage = receivedLists
        .map(list => {
          const id = getListId(list);
          if (!id) {
            return null;
          }
        return {
            id,
            title: list?.title ?? list?.name ?? 'Untitled List',
            listType: list?.listType ?? null,
            pinned: Boolean(list?.pinned ?? list?.isPinned),
            createdAt: list?.createdAt ?? null,
            updatedAt: list?.updatedAt ?? null,
            createdByUserId:
              list?.createdByUserId != null ? String(list.createdByUserId) : null,
          };
        })
        .filter(Boolean);

      try {
        await replaceListsInDb(listsForStorage);
      } catch (persistError) {
        console.error('Failed to persist lists locally', persistError);
      }
    } catch (err) {
      console.error('Failed to load lists', err);
       if (isMountedRef.current) {
        setError('Unable to load lists. Pull to refresh.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setHasLoaded(true);
      }
    }
  }, [applyLists, getListId]);

  useEffect(() => {
     loadListsFromDatabase();
  }, [loadListsFromDatabase]);

  useFocusEffect(
    useCallback(() => {
      fetchLists();
    }, [fetchLists]),
  );

   useEffect(() => {
    setPinnedIds(prev => {
      if (!prev.size) return prev;
      const valid = new Set();
      let changed = false;
      prev.forEach(id => {
        const exists = lists.some(list => getListId(list) === id);
        if (exists) {
          valid.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? valid : prev;
    });

    setSelectedIds(prev => {
      if (!prev.size) return prev;
      const valid = new Set();
      let changed = false;
      prev.forEach(id => {
        const exists = lists.some(list => getListId(list) === id);
        if (exists) {
          valid.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? valid : prev;
    });
  }, [lists, getListId]);

  const selectionCount = selectedIds.size;
  const isSelectionMode = selectionCount > 0;
  const selectedIdArray = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const pinnedIdArray = useMemo(() => Array.from(pinnedIds), [pinnedIds]);
  const allSelectedPinned =
    selectedIdArray.length > 0 && selectedIdArray.every(id => pinnedIds.has(id));
  const flatListExtraData = useMemo(
    () => ({ selected: selectedIdArray, pinned: pinnedIdArray, mode: isSelectionMode }),
    [selectedIdArray, pinnedIdArray, isSelectionMode],
  );

  const sortedLists = useMemo(() => {
    if (!pinnedIds.size) {
      return lists;
    }
    const pinned = [];
    const others = [];
    lists.forEach(list => {
      const id = getListId(list);
      if (id && pinnedIds.has(id)) {
        pinned.push(list);
      } else {
        others.push(list);
      }
    });
    return [...pinned, ...others];
  }, [lists, pinnedIds, getListId]);

  const handleLongPress = useCallback(listId => {
    if (!listId) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.add(listId);
      return next;
    });
  }, []);

  const handlePinToggle = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    
    const shouldUnpin = ids.every(id => pinnedIds.has(id));
    setIsLoading(true);
    setError(null);

    try {
      const session = await getStoredSession();
      const userIdValue = session?.userId ? Number(session.userId) : null;

      if (!userIdValue) {
        setError('Please sign in again to update pinned lists.');
        return;
      }

      await Promise.all(
        ids.map(id =>
          apiClient.put(
            `/api/lists/${id}/pin`,
            { pinned: !shouldUnpin },
            { headers: { 'X-User-Id': String(userIdValue) } },
          ),
        ),
      );

      setPinnedIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => {
          if (shouldUnpin) {
            next.delete(id);
          } else {
            next.add(id);
          }
        });
        return next;
      });
      setLists(prev =>
        prev.map(list => {
          const listId = getListId(list);
          if (listId && ids.includes(listId)) {
            return { ...list, pinned: !shouldUnpin };
          }
          return list;
        }),
      );

      try {
        await updateListPinnedInDb(ids, !shouldUnpin);
      } catch (dbError) {
        console.error('Failed to update pinned state locally', dbError);
      }
      clearSelection();
    } catch (err) {
      console.error('Failed to update pinned lists', err);
      setError('Unable to update pinned status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedIds, pinnedIds, clearSelection, getListId]);

 const deleteListsByIds = useCallback(
    async ids => {
      if (!ids.length) return;

      setIsLoading(true);
      setError(null);

      try {
        const session = await getStoredSession();
        const userIdValue = session?.userId ? Number(session.userId) : null;

        if (!userIdValue) {
          setError('Please sign in again to delete lists.');
          return;
        }

        await Promise.all(
          ids.map(id =>
            apiClient.delete(`/api/lists/${id}`, {
              headers: { 'X-User-Id': String(userIdValue) },
            }),
          ),
        );

        const idSet = new Set(ids);
        setLists(prev =>
          prev.filter(list => {
            const listId = getListId(list);
            return !(listId && idSet.has(listId));
          }),
      );
        clearSelection();
        setPinnedIds(prev => {
          if (!prev.size) return prev;
          const next = new Set(prev);
          let changed = false;
          idSet.forEach(id => {
            if (next.delete(id)) {
              changed = true;
            }
          });
          return changed ? next : prev;
        });

        try {
          await deleteListsFromDb(ids);
        } catch (dbError) {
          console.error('Failed to delete lists locally', dbError);
        }
         } catch (err) {
        console.error('Failed to delete lists', err);
        setError('Unable to delete selected lists. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [clearSelection, getListId],
  );

  const handleDeleteSelected = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    const count = ids.length;
    const title = count === 1 ? 'Delete this list?' : `Delete ${count} lists?`;

    Alert.alert(
      title,
      "The selected items won't be viewable once deleted.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteListsByIds(ids);
          },
        },
      ],
      { cancelable: true },
    );
  }, [selectedIds, deleteListsByIds]);

  const listCountLabel = useMemo(() => {
    if (!hasLoaded && isLoading) {
      return 'Loading…';
    }

    const count = lists.length;
    return `${count} ${count === 1 ? 'list' : 'lists'}`;
  }, [hasLoaded, isLoading, lists.length]);
  
  const renderListItem = ({ item, index }) => {
    const bg = bgColors[index % bgColors.length];
    const title = item?.title || item?.name || 'Untitled List';
    const listId = getListId(item);
    const isSelected = listId != null && selectedIds.has(listId);
    const isPinned = listId != null && pinnedIds.has(listId);

    const handlePress = () => {
      if (isSelectionMode && listId) {
        toggleSelection(listId);
        return;
      }

      router.push({
        pathname: '/screens/ViewListScreen',
        params: {
          listName: title,
          listId,
        },
      });
    };

    const onLongPress = listId
      ? () => {
          if (isSelectionMode) {
            toggleSelection(listId);
          } else {
            handleLongPress(listId);
          }
        }
      : undefined;

    return (
        <TouchableOpacity
        style={[styles.listItem, isSelected && styles.selectedListItem]}
        onPress={handlePress}
        onLongPress={onLongPress}
        delayLongPress={250}
        activeOpacity={0.8}
      >
         <View
          style={[
            styles.iconCircle,
            { backgroundColor: bg },
            isSelected && styles.selectedIconCircle,
          ]}
        >
          <Icon
            name={isSelectionMode ? (isSelected ? 'check' : 'shopping-cart') : 'shopping-cart'}
            size={24}
            color={isSelected ? '#1f6ea7' : '#fff'}
          />
        </View>
         <Text style={[styles.listName, isSelected && styles.selectedListName]}>{title}</Text>
        {isPinned ? (
          <Icon name="push-pin" size={18} color="#1f6ea7" style={styles.pinBadge} />
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
      {isSelectionMode ? (
          <>
            <TouchableOpacity style={styles.iconBtn} onPress={clearSelection}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.headerTitle}>{selectionCount} selected</Text>
              <Text style={styles.headerSubtitle}>
                {allSelectedPinned ? 'Pinned' : 'Select items'}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={handlePinToggle}>
                <Icon
                  name="push-pin"
                  size={24}
                  color={allSelectedPinned ? '#ffd54f' : '#fff'}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handleDeleteSelected}>
                <Icon name="delete" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                router.replace('/screens/MocScreen');
              }}
            >
              <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.headerTitle}>Select List</Text>
              <Text style={styles.headerSubtitle}>{listCountLabel}</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconBtn}>
                <Icon name="search" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn}>
                <Icon name="more-vert" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* New List */}
      <View style={styles.newListContainer}><TouchableOpacity
          style={styles.newListBtn}
          onPress={() => router.push('/screens/NewListScreen')}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#1f6ea7' }]}>
            <Icon name="playlist-add" size={24} color="#fff" />
          </View>
          <Text style={styles.newListTitle}>New list</Text>
        </TouchableOpacity>
      </View>

      {/* Section header */}
      <Text style={styles.sectionTitle}>Lists you have on MoC</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Existing Lists */}
      <FlatList
        data={sortedLists}
        keyExtractor={(item, index) => {
          const id = getListId(item);
          return id != null ? id : `list-${index}`;
        }}
        renderItem={renderListItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
         extraData={flatListExtraData}
         refreshControl={(
          <RefreshControl refreshing={isLoading} onRefresh={fetchLists} />
        )}
        ListEmptyComponent={
          hasLoaded && !isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No lists yet</Text>
              <Text style={styles.emptySubtitle}>
                Create a new list to get started.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: HEADER_HEIGHT,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  iconBtn: {
    padding: 4,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 4,
    justifyContent:'center'
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#e0f2ff',
    fontSize: 12,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
  },

  newListContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    // no border here
  },
  newListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newListTitle: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },

  sectionTitle: {
    marginTop: 12,
    marginHorizontal: 12,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },

  listContainer: {
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listName: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
   selectedListItem: {
    backgroundColor: '#e6f2ff',
  },
  selectedIconCircle: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#1f6ea7',
  },
  selectedListName: {
    color: '#1f6ea7',
    fontWeight: '600',
  },
  pinBadge: {
    marginLeft: 'auto',
  },
  errorText: {
    marginHorizontal: 12,
    marginTop: 6,
    color: '#d9534f',
    fontSize: 13,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});
