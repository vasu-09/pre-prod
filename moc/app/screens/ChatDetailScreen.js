// ChatDetailScreen.js
import { useNavigation, useRoute } from '@react-navigation/native';
import { Audio } from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useChatRegistry } from '../context/ChatContext';
import useCallSignalingHook from '../hooks/useCallSignaling';
import { useChatSession } from '../hooks/useChatSession';
import apiClient from '../services/apiClient';
import {
  deleteMessagesFromDb,
  getListSummaryFromDb,
  getListsFromDb,
  initializeDatabase,
  saveListSummaryToDb,
  updateMessageDeletionInDb,
} from '../services/database';
import {
  deleteMessageForEveryone,
  deleteMessageForMe,
} from '../services/messagesService';

const BAR_HEIGHT = 56;
const MESSAGE_BAR_HEIGHT = 48;
const MARGIN = 8;
const MIC_SIZE = 48;
const SWIPE_REPLY_THRESHOLD = 40;
const SWIPE_START_THRESHOLD = 12;
const SWIPE_MAX_DISTANCE = 72;
const SWIPE_ICON_THRESHOLD = 20;
const DECRYPTION_PENDING_TEXT = 'Waiting for this message. This may take a while.';
const HELP_CENTER_URL = 'https://mocconnect.in/';
const DELETED_MESSAGE_TEXT = 'This message was deleted';

const getIsoTs = msg =>
  msg?.serverTs ||
  msg?.raw?.serverTs ||
  null;

const dayKeyFromIso = iso => {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDayLabel = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const startOf = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();

  const diffDays = Math.round((startOf(now) - startOf(d)) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' });
};

export const formatDurationText = millis => {
  const totalSeconds = Math.max(0, Math.floor((millis || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};


export const MessageContent = ({
  item,
  playingMessageId,
  onTogglePlayback,
  onRetryDecrypt,
  deletedForEveryone = false,
  deletedLabel,
  replyMeta,
}) => {
  const [overrideText, setOverrideText] = useState(null);
  const [retryStatus, setRetryStatus] = useState('idle');

  useEffect(() => {
    setOverrideText(null);
    setRetryStatus('idle');
  }, [item.id]);

  useEffect(() => {
    if (overrideText && item.text && !item?.raw?.decryptionFailed) {
      setOverrideText(null);
    }
  }, [item.text, item?.raw?.decryptionFailed, overrideText]);

  useEffect(() => {
    const shouldRetry = Boolean(onRetryDecrypt) && Boolean(item.failed || item?.raw?.decryptionFailed);
    if (!shouldRetry) {
      return undefined;
    }

    let cancelled = false;
    setRetryStatus('retrying');
    onRetryDecrypt(item)
      .then(result => {
        if (cancelled) return;
        if (result) {
          setOverrideText(result);
          setRetryStatus('idle');
        } else {
          setRetryStatus('failed');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRetryStatus('failed');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [item.id, item.failed, item?.raw?.decryptionFailed, onRetryDecrypt]);

  const fallbackText = item.text ?? item?.raw?.body ?? 'Encrypted message';
  const messageText = overrideText ?? fallbackText;

  const isPendingPlaceholder = messageText === DECRYPTION_PENDING_TEXT;
  const rawDeliveryStatus = item?.raw?.deliveryStatus ?? item?.raw?.status;
  const readFlag = item.readByPeer || item?.raw?.readByPeer;
  const deliveryStatus =
    readFlag ? 'READ' : rawDeliveryStatus ?? (item.pending ? 'PENDING' : 'SENT_TO_WS');
  const isSender = item.sender === 'me';
  const isPendingState = item.pending || deliveryStatus === 'PENDING';
  const isSentToWs = deliveryStatus === 'SENT_TO_WS';
  const isDelivered = deliveryStatus === 'DELIVERED_TO_DEVICE';
  const isRead = deliveryStatus === 'READ';
  const statusColor = item.failed
    ? '#b3261e'
    : item.sender === 'me'
      ? '#7a7a7a'
      : '#777';
  const statusIconColor = isRead ? '#1f6ea7' : '#7a7a7a';
  const showClock = isSender && isPendingState;
  const showSingleTick = isSender && !showClock && isSentToWs;
  const showDoubleTick = isSender && !showClock && (isDelivered || isRead);
  const showStatusRow = isSender && (showClock || showSingleTick || showDoubleTick);
  const renderStatusIcon = size => {
    if (!isSender) return null;
    if (showClock) {
      return <Icon name="schedule" size={size} color={statusIconColor} style={styles.statusIcon} />;
    }
    if (showSingleTick) {
      return <Icon name="check" size={size} color={statusIconColor} style={styles.statusIcon} />;
    }
    if (showDoubleTick) {
      return (
        <Icon
          name="done-all"
          size={size}
          color={statusIconColor}
          style={styles.statusIcon}
        />
      );
    }
    return null;
  };
  const decryptionFailed = Boolean(item?.raw?.decryptionFailed);
  const showEncryptedPlaceholder = decryptionFailed && !overrideText;
  const showWaitingMessage =
    showEncryptedPlaceholder || retryStatus !== 'idle' || isPendingPlaceholder;
  const handleLearnMore = useCallback(() => {
    Linking.openURL(HELP_CENTER_URL).catch(() => {
      Alert.alert('Error', 'Unable to open Help Center');
    });
  }, []);
  const structuredPayload = useMemo(() => {
    if (showEncryptedPlaceholder || isPendingPlaceholder || !messageText || typeof messageText !== 'string') {
      return null;
    }
    try {
      return JSON.parse(messageText);
    } catch {
      return null;
    }
  }, [decryptionFailed, isPendingPlaceholder, messageText]);
  const todoPayload = useMemo(() => {
    if (structuredPayload?.type === 'todo_table' && Array.isArray(structuredPayload?.rows)) {
      return structuredPayload;
    }
    if (structuredPayload?.type === 'todo_list' && Array.isArray(structuredPayload?.items)) {
      return structuredPayload;
    }
    return null;
  }, [structuredPayload]);

  const imagePayload = useMemo(() => {
    if (structuredPayload?.type !== 'image') {
      return null;
    }
    const media = Array.isArray(structuredPayload?.media)
      ? structuredPayload.media.filter(entry => typeof entry?.url === 'string' && entry.url)
      : [];
    if (!media.length) {
      return null;
    }
    return {
      media,
      caption: typeof structuredPayload?.caption === 'string' ? structuredPayload.caption : '',
    };
  }, [structuredPayload]);

  const replyPayload = useMemo(() => {
    if (structuredPayload?.type === 'reply' && typeof structuredPayload?.body === 'string') {
      return structuredPayload;
    }
    return null;
  }, [structuredPayload]);
  const replyDetails = replyMeta ?? replyPayload?.replyTo ?? null;
  const replyBodyText = replyPayload?.body ?? messageText;
  const locationPayload = useMemo(() => {
    if (structuredPayload?.type !== 'location') {
      return null;
    }
    const latitude = Number(structuredPayload?.coords?.latitude);
    const longitude = Number(structuredPayload?.coords?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    const mapboxToken =
      process.env.EXPO_PUBLIC_MAPBOX_TOKEN ||
      Constants?.expoConfig?.extra?.mapboxToken ||
      Constants?.manifest2?.extra?.mapboxToken ||
      '';
      console.log('mapboxToken prefix:', (mapboxToken || '').slice(0, 10));
    const mapboxUrl = `https://www.mapbox.com/maps/?center=${longitude},${latitude}&zoom=15`;
    return {
      latitude,
      longitude,
      url:
        structuredPayload?.url ??
        (mapboxToken ? mapboxUrl : `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`),
      mapboxToken,
    };
  }, [structuredPayload]);
  const isTablePayload = todoPayload?.type === 'todo_table';
  const tableRows = isTablePayload ? (todoPayload?.rows ?? []) : [];
  const listItems = todoPayload?.type === 'todo_list' ? (todoPayload?.items ?? []) : [];
  const showDeletedMessage = Boolean(deletedForEveryone);
  const { primaryMapUrl, fallbackMapUrl } = useMemo(() => {
    if (!locationPayload) {
      return { primaryMapUrl: null, fallbackMapUrl: null };
    }
    const { latitude, longitude, mapboxToken } = locationPayload;
    const center = `${latitude},${longitude}`;
    const size = '600x300';
    const zoom = '15';
    const marker = `${latitude},${longitude},red-pushpin`;
    if (mapboxToken) {
      const mapboxMarker = `pin-s+e11d48(${longitude},${latitude})`;
      const encodedMarker = encodeURIComponent(mapboxMarker);
      const mapboxSize = '600x300';
      const mapUrls = {
        primaryMapUrl:
          `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${encodedMarker}/` +
          `${longitude},${latitude},${zoom}/${mapboxSize}?access_token=${mapboxToken}`,
        fallbackMapUrl: `https://staticmap.openstreetmap.de/staticmap.php?center=${encodeURIComponent(center)}&zoom=${zoom}&size=${size}&markers=${encodeURIComponent(marker)}`,
      };
      console.log('primaryMapUrl:', mapUrls.primaryMapUrl);
      console.log('fallbackMapUrl:', mapUrls.fallbackMapUrl);
      return mapUrls;
    }
    const mapUrls = {
      primaryMapUrl: `https://staticmap.openstreetmap.de/staticmap.php?center=${encodeURIComponent(center)}&zoom=${zoom}&size=${size}&markers=${encodeURIComponent(marker)}`,
      fallbackMapUrl: null,
    };
    console.log('primaryMapUrl:', mapUrls.primaryMapUrl);
    console.log('fallbackMapUrl:', mapUrls.fallbackMapUrl);
    return mapUrls;
  }, [locationPayload]);
  const [mapImageState, setMapImageState] = useState('primary');
  useEffect(() => {
    setMapImageState('primary');
  }, [primaryMapUrl, fallbackMapUrl]);
  const locationImageUrl =
    mapImageState === 'fallback' ? fallbackMapUrl : mapImageState === 'primary' ? primaryMapUrl : null;
  const tableTotal = useMemo(() => {
    if (!isTablePayload) return null;
    if (todoPayload?.total) {
      return todoPayload.total;;
    }
    const totalValue = tableRows.reduce((sum, row) => {
      const rowValue = parseInt(String(row?.price ?? '').replace(/[^0-9]/g, ''), 10) || 0;
      return sum + rowValue;
    }, 0);
    return `₹${totalValue}`;
  }, [isTablePayload, todoPayload, tableRows]);
  return (
    <View style={styles.messageContentRow}>
      {item.audio ? (
        <View style={[styles.audioMessageRow, styles.messageTextFlex]}>
          <TouchableOpacity
            style={styles.audioPlayButton}
            onPress={() => onTogglePlayback(item)}
            disabled={item.pending || item.failed}
          >
            <Icon
              name={playingMessageId === item.id ? 'pause' : 'play-arrow'}
              size={28}
              color="#1f6ea7"
            />
          </TouchableOpacity>
          <Text style={styles.audioDurationText}>{formatDurationText(item.duration)}</Text>
        </View>
      ) : (
        <View style={[styles.messageTextFlex, styles.messageTextWrapper]}>
          {showDeletedMessage ? (
            <View style={styles.deletedMessageRow}>
              <Icon name="block" size={16} color="#8f8f8f" style={styles.deletedMessageIcon} />
              <Text style={styles.deletedMessageText}>
                {deletedLabel || DELETED_MESSAGE_TEXT}
              </Text>
            </View>
          ) : todoPayload ? (
            <View style={styles.tableWrapper}>
              {todoPayload.title ? (
                <Text style={styles.tableTitle}>{todoPayload.title}</Text>
              ) : null}
              {isTablePayload ? (
                <>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableCell, styles.tableIndexCell, styles.tableHeaderText]}>
                      #
                    </Text>
                    <Text style={[styles.tableCell, styles.tableItemCell, styles.tableHeaderText]}>
                      Item
                    </Text>
                    <Text style={[styles.tableCell, styles.tableQtyCell, styles.tableHeaderText]}>
                      Qty
                    </Text>
                    <Text style={[styles.tableCell, styles.tablePriceCell, styles.tableHeaderText]}>
                      Price
                    </Text>
                  </View>
                  {tableRows.map((row, index) => (
                    <View
                      style={[
                        styles.tableRow,
                        index < tableRows.length - 1 ? styles.tableRowDivider : null,
                      ]}
                      key={`${row?.name ?? 'row'}-${index}`}
                    >
                      <Text style={[styles.tableCell, styles.tableIndexCell]}>{index + 1}.</Text>
                      <Text style={[styles.tableCell, styles.tableItemCell]}>{row?.name}</Text>
                      <Text style={[styles.tableCell, styles.tableQtyCell]}>{row?.qty}</Text>
                      <Text style={[styles.tableCell, styles.tablePriceCell]}>{row?.price}</Text>
                    </View>
                  ))}
                  <View style={styles.tableTotalRow}>
                    <Text style={[styles.tableCell, styles.tableTotalLabel]}>Total</Text>
                    <Text style={[styles.tableCell, styles.tablePriceCell, styles.tableTotalValue]}>
                      {tableTotal}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.todoListRows}>
                  {listItems.map((row, index) => {
                    const checked = Boolean(row?.checked);
                    return (
                      <View
                        style={[
                          styles.todoListRow,
                          index < listItems.length - 1 ? styles.todoListRowDivider : null,
                        ]}
                        key={`${row?.name ?? 'row'}-${index}`}
                      >
                        <Icon
                          name={checked ? 'check-box' : 'check-box-outline-blank'}
                          size={16}
                          color={checked ? '#1f6ea7' : '#7a7a7a'}
                          style={styles.todoListCheckbox}
                        />
                        <Text style={styles.todoListIndex}>{index + 1}.</Text>
                        <Text style={styles.todoListText}>{row?.name}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
              {item.time ? (
                <View style={styles.tableMetaRow}>
                  <Text
                    style={[
                      styles.tableTime,
                      item.sender === 'me' ? styles.myTime : styles.theirTime,
                      item.pending ? styles.pendingTime : null,
                      item.failed ? styles.failedTime : null,
                      { color: statusColor },
                    ]}
                  >
                    {item.time}
                  </Text>
                  {showStatusRow ? (
                    renderStatusIcon(12)
                  ) : null}
                </View>
              ) : null}
              </View>
             ) : imagePayload ? (
            <View style={styles.imageMessageWrapper}>
              {imagePayload.media.length > 1 ? (
                <View style={styles.imageGrid}>
                  {imagePayload.media.slice(0, 4).map((entry, index) => (
                    <Image
                      key={`${entry.url}-${index}`}
                      source={{ uri: entry.thumbUrl || entry.url }}
                      style={styles.imageGridItem}
                      resizeMode="cover"
                    />
                  ))}
                </View>
              ) : (
                <Image source={{ uri: imagePayload.media[0].url }} style={styles.imageSingle} resizeMode="cover" />
              )}
              {imagePayload.caption ? <Text style={styles.messageText}>{imagePayload.caption}</Text> : null}
            </View>
             ) : locationPayload ? (
           <View style={styles.locationMessageWrapper}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => Linking.openURL(locationPayload.url)}
                style={styles.locationCard}
              >
                <View style={styles.locationMapWrapper}>
                  {locationImageUrl ? (
                    <Image
                      source={{ uri: locationImageUrl }}
                      style={styles.locationMapImage}
                      resizeMode="cover"
                      onError={(e) => {
                        console.warn('Map image load failed:', locationImageUrl, e?.nativeEvent);
                        if (mapImageState === 'primary' && fallbackMapUrl) {
                          setMapImageState('fallback');
                        } else {
                          setMapImageState('error');
                        }
                      }}
                    />
                  ) : (
                    <View style={styles.locationMapPlaceholder}>
                      <Icon name="map" size={24} color="#6b7280" />
                    </View>
                  )}
                  <Icon name="place" size={24} color="#e11d48" style={styles.locationMapPin} />
                </View>
              </TouchableOpacity>
              {todoPayload ? null : (
                <View style={styles.locationTimeRow}>
                  {item.time ? (
                    <Text
                      style={[
                        styles.messageTime,
                        styles.locationTimeText,
                        item.sender === 'me' ? styles.myTime : styles.theirTime,
                        item.pending ? styles.pendingTime : null,
                        item.failed ? styles.failedTime : null,
                        { color: statusColor },
                      ]}
                    >
                      {item.time}
                    </Text>
                  ) : null}
                  {showStatusRow ? (
                    renderStatusIcon(12)
                  ) : null}
                </View>
              )}
              </View>
             ) : replyDetails ? (
            <View style={styles.replyMessageWrapper}>
              <View style={styles.replyQuoteRow}>
                <View
                  style={[
                    styles.replyStripe,
                    replyDetails?.isMine
                      ? styles.replyStripeMine
                      : styles.replyStripeOther,
                  ]}
                />
                <View style={styles.replyQuoteTextArea}>
                  <Text style={styles.replyQuoteTitle} numberOfLines={1}>
                    {replyDetails?.senderLabel ?? 'Reply'}
                  </Text>
                  <Text style={styles.replyQuotePreview} numberOfLines={1}>
                    {replyDetails?.previewText ?? ''}
                  </Text>
                </View>
              </View>

              <Text style={styles.messageText}>{replyBodyText}</Text>
            </View>
             ) : showWaitingMessage ? (
            <View style={styles.waitingMessageRow}>
              <Icon name="schedule" size={16} color="#1f6ea7" style={styles.waitingMessageIcon} />
              <View style={styles.waitingMessageContent}>
                <Text style={[styles.messageTextwaiting, styles.waitingMessageText]}>
                  {DECRYPTION_PENDING_TEXT}{' '}
                  <Text style={styles.learnMoreLink} onPress={handleLearnMore}>
                    Learn more
                  </Text>
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.messageText}>{messageText}</Text>
          )}
        </View>
      )}
       {todoPayload ? null : locationPayload ? null : imagePayload ? null : showStatusRow ? (
        <View style={styles.messageStatusRow}>
          {item.time ? (
            <Text
              style={[
                styles.messageTime,
                styles.inlineTime,
                styles.statusTimeInRow,
                item.sender === 'me' ? styles.myTime : styles.theirTime,
                item.pending ? styles.pendingTime : null,
                item.failed ? styles.failedTime : null,
                { color: statusColor },
              ]}
            >
              {item.time}
            </Text>
          ) : null}
          {renderStatusIcon(12)}
        </View>
      ) : (
        <Text
          style={[
            styles.messageTime,
            styles.inlineTime,
            item.sender === 'me' ? styles.myTime : styles.theirTime,
            item.pending ? styles.pendingTime : null,
            item.failed ? styles.failedTime : null,
            { color: statusColor },
          ]}
        >
          {item.time}
        </Text>
      )}
    </View>
  );
};

const isTableMessage = message => {
  if (!message || typeof message !== 'string') {
    return false;
  }
  try {
    const parsed = JSON.parse(message);
     return (
      (parsed?.type === 'todo_table' && Array.isArray(parsed?.rows)) ||
      (parsed?.type === 'todo_list' && Array.isArray(parsed?.items))
    );
  } catch {
    return false;
  }
};

export default function ChatDetailScreen() {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const inputRef = useRef(null);
  const [replyBarHeight, setReplyBarHeight] = useState(0);
  const swipeTranslateX = useRef(new Map());
  const [showListPicker, setShowListPicker] = useState(false);
  const [selectedListId, setSelectedListId] = useState(null);
  const flatListRef = useRef();
  const activeCallIdRef = useRef(null);
  const [attachMenuVisible, setAttachMenuVisible] = useState(false);
  const router = useRouter();
  const navigation = useNavigation();
  const route = useRoute();
  const { rooms } = useChatRegistry();
  const params = useLocalSearchParams();
  const paramRoomId = params?.roomId ? Number(params.roomId) : null;
  const paramRoomKey = params?.roomKey ? String(params.roomKey) : null;
  const paramTitle = params?.title ? String(params.title) : null;
  const paramPeerId = params?.peerId ? Number(params.peerId) : null;
  const paramLocation = params?.location ?? null;
  const paramMediaPayload = params?.mediaPayload ?? null;
  console.log('[ChatDetailScreen] params', params);
  const roomSummary = useMemo(() => {
    if (!rooms?.length) return null;
    return (
      rooms.find(
        room =>
          (paramRoomId != null && room.id === paramRoomId) ||
          (paramRoomKey && room.roomKey === paramRoomKey),
      ) ?? null
    );
  }, [rooms, paramRoomId, paramRoomKey]);
  const roomId = paramRoomId ?? roomSummary?.id ?? null;
  const roomKey = paramRoomKey ?? roomSummary?.roomKey ?? null;
  const chatTitle = paramTitle ?? roomSummary?.title ?? 'Chat';
  const peerId = paramPeerId ?? roomSummary?.peerId ?? null;
  const phoneNumber = useMemo(() => {
    const rawPhone = params?.phone ?? roomSummary?.peerPhone;
    if (Array.isArray(rawPhone)) return rawPhone[0] ?? '';
    return rawPhone ? String(rawPhone) : '';
  }, [params, roomSummary]);

  const {
    messages: sessionMessages,
    sendTextMessage,
    sendImageMessage,
    notifyTyping,
    markLatestRead,
    typingUsers,
    isLoading: isHistoryLoading,
    error: historyError,
    currentUserId,
    retryDecryptMessage
  } = useChatSession({ roomId, roomKey, peerId, title: chatTitle });

  const [sharedLists, setSharedLists] = useState([]);
  const [sharedListsLoading, setSharedListsLoading] = useState(false);
  const [sharedListError, setSharedListError] = useState(null);
  const [selectedListData, setSelectedListData] = useState(null);
  const [isSelectedListLoading, setIsSelectedListLoading] = useState(false);
  const [hasFetchedSharedLists, setHasFetchedSharedLists] = useState(false);
  const [selectedListError, setSelectedListError] = useState(null);

  const normalizePhoneNumber = useCallback(value => {
    if (!value) return '';
    return String(value).replace(/\D/g, '');
  }, []);

  const loadSharedListsFromDatabase = useCallback(async () => {
    if (!phoneNumber) {
      return [];
    }

    try {
      await initializeDatabase();
      const storedLists = await getListsFromDb();
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      const filteredLists = storedLists.filter(list =>
        (list?.members ?? []).some(
          member => normalizePhoneNumber(member?.phone) === normalizedPhone,
        ),
      );

      return filteredLists
        .map(list => ({
          id: list?.id != null ? String(list.id) : null,
          title: list?.title ?? 'Untitled List',
        }))
        .filter(list => list.id);
    } catch (dbError) {
      console.error('Failed to load shared lists from database', dbError);
      return [];
    }
  }, [normalizePhoneNumber, phoneNumber]);

  const loadSelectedListFromDatabase = useCallback(
    async listId => {
      if (!listId) {
        return null;
      }

      try {
        await initializeDatabase();
        const storedList = await getListSummaryFromDb(String(listId));
        if (!storedList) {
          return null;
        }

        const normalizedItems = normalizeItems(storedList?.items ?? []);
        return {
          id: storedList?.id != null ? String(storedList.id) : String(listId),
          title: storedList?.title ?? 'Shared List',
          items: normalizedItems,
        };
      } catch (dbError) {
        console.error('Failed to load shared list from database', dbError);
        return null;
      }
    },
    [normalizeItems],
  );

  useEffect(() => () => {
    activeCallIdRef.current = null;
  }, []);

  const [localMessages, setLocalMessages] = useState([]);
  const [deletedMessageIds, setDeletedMessageIds] = useState([]);
  const [deletedForEveryoneIds, setDeletedForEveryoneIds] = useState([]);
  const isDeletedForEveryone = useCallback(
    msg =>
      deletedForEveryoneIds.includes(msg.id) ||
      msg?.raw?.deletedForEveryone ||
      msg?.text === DELETED_MESSAGE_TEXT ||
      msg?.raw?.body === DELETED_MESSAGE_TEXT,
    [deletedForEveryoneIds],
  );
  const isDeletedForMe = useCallback(
    msg => {
      if (deletedMessageIds.includes(msg.id)) {
        return true;
      }
      if (!currentUserId || isDeletedForEveryone(msg)) {
        return false;
      }
      if (msg.sender === 'me') {
        return Boolean(msg?.raw?.deletedBySender);
      }
      return Boolean(msg?.raw?.deletedByReceiver);
    },
    [currentUserId, deletedMessageIds, isDeletedForEveryone],
  );
  const createLocalMessageId = useCallback(
    () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );
  const messages = useMemo(
    () => [...sessionMessages, ...localMessages],
    [sessionMessages, localMessages],
  );
  const filteredMessages = useMemo(
    () => messages.filter(message => !isDeletedForMe(message)),
    [messages, isDeletedForMe],
  );
  const chatItems = useMemo(() => {
    const sorted = filteredMessages
      .slice()
      .sort((a, b) => {
        const aIso = getIsoTs(a) ?? '';
        const bIso = getIsoTs(b) ?? '';
        if (aIso === bIso) return String(a.id).localeCompare(String(b.id));
        return aIso.localeCompare(bIso);
      });

    const items = [];
    let lastDayKey = null;

    for (const msg of sorted) {
      const iso = getIsoTs(msg);
      const dayKey = dayKeyFromIso(iso);

      if (dayKey !== lastDayKey) {
        lastDayKey = dayKey;
        items.push({
          kind: 'date',
          id: `date-${dayKey}`,
          label: formatDayLabel(iso),
        });
      }

      items.push({ kind: 'msg', id: `msg-${msg.id}`, msg });
    }

    return items;
  }, [filteredMessages]);
  const messagesRef = useRef([]);
  useEffect(() => {
    messagesRef.current = filteredMessages;
  }, [filteredMessages]);
  const subtitleText = typingUsers.length
    ? 'typing…'
    : 'Messages are end-to-end encrypted';
  const avatarUri = params?.image && String(params.image).trim() ? String(params.image) : null;
  const avatarSource = avatarUri ? { uri: avatarUri } : null;
  const isRoomReady = Boolean(roomId && (roomKey || roomId));

  const recordingRef = useRef(null);
  const previewSoundRef = useRef(null);
  const playbackSoundRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [pendingDeleteMessages, setPendingDeleteMessages] = useState([]);
  const lastLocationRef = useRef(null);
  const lastMediaPayloadRef = useRef(null);

  const getReplyPreviewText = useCallback(msg => {
    if (!msg) return '';
    if (msg.audio) return 'Audio message';
    if (msg.image) return 'Photo';
    if (msg.isFile) return msg.text || 'Document';
    const text = msg.text ?? msg?.raw?.body ?? '';
    if (!text) return 'Message';
    return String(text).replace(/\s+/g, ' ').trim();
  }, []);
const makeReplyPayload = useCallback(
    message => {
      if (!message) return null;
      const isMine = message.sender === 'me';
      return {
        messageId: message.id,
        senderId: message.senderId ?? null,
        senderLabel: isMine ? 'You' : chatTitle,
        previewText: getReplyPreviewText(message),
        isMine,
      };
    },
    [chatTitle, getReplyPreviewText],
  );
  const getReplyMetaForMessage = useCallback(
    message => {
      if (!message?.raw) {
        return null;
      }
      const replyPreview = message.raw.replyToPreview;
      const replyMessageId = message.raw.replyToMessageId;
      const replySenderId = message.raw.replyToSenderId;
      if (!replyPreview && !replyMessageId && replySenderId == null) {
        return null;
      }
      if (replySenderId == null) {
        return null;
      }
      const isMine =
        currentUserId != null && replySenderId != null ? replySenderId === currentUserId : false;
      return {
        senderLabel: isMine ? 'You' : chatTitle,
        previewText: replyPreview ?? 'Message',
        isMine,
      };
    },
    [chatTitle, currentUserId],
  );
  const beginReply = useCallback(
    message => {
      const payload = makeReplyPayload(message);
      if (!payload) {
        return;
      }
      setReplyTo(payload);
      clearSelection();
      focusComposer();
    },
    [clearSelection, focusComposer, makeReplyPayload],
  );
  const getSwipeTranslateX = useCallback(id => {
    if (!swipeTranslateX.current.has(id)) {
      swipeTranslateX.current.set(id, new Animated.Value(0));
    }
    return swipeTranslateX.current.get(id);
  }, []);

  const resetSwipe = useCallback((animatedValue, onComplete) => {
    Animated.spring(animatedValue, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start(() => {
      if (onComplete) {
        onComplete();
      }
    });
  }, []);
  const handleCallRoomEvent = useCallback(
    event => {
      if (!event || event.type !== 'call.invite') {
        return;
      }
      const eventRoomId =
        typeof event.roomId === 'number' ? event.roomId : Number(event.roomId ?? roomId);
      if (!roomId || Number.isNaN(eventRoomId) || eventRoomId !== roomId) {
        return;
      }
      const callId = typeof event.callId === 'number' ? event.callId : Number(event.callId);
      if (!callId || Number.isNaN(callId)) {
        return;
      }
      if (activeCallIdRef.current === callId) {
        return;
      }
      const fromId = typeof event.from === 'number' ? event.from : Number(event.from);
      const calleeIds = Array.isArray(event.callees)
        ? event.callees
            .map(value => (typeof value === 'number' ? value : Number(value)))
            .filter(value => !Number.isNaN(value))
        : [];
      const participants = [...calleeIds, fromId].filter(value => !Number.isNaN(value));
      if (currentUserId != null && !participants.includes(currentUserId)) {
        return;
      }
      activeCallIdRef.current = callId;
      const role = fromId === currentUserId ? 'caller' : 'callee';
      router.push({
        pathname: '/screens/CallScreen',
        params: {
          callId: String(callId),
          roomId: roomId ? String(roomId) : '',
          name: chatTitle,
          ...(avatarUri ? { image: avatarUri } : {}),
          role,
          peerId: peerId != null ? String(peerId) : undefined,
        },
      });
      setTimeout(() => {
        if (activeCallIdRef.current === callId) {
          activeCallIdRef.current = null;
        }
      }, 3000);
    },
    [roomId, currentUserId, router, chatTitle, avatarUri, peerId],
  );

  const handleQueueEvent = useCallback(
    event => {
      if (!event) {
        return;
      }
      if (event.type === 'call.busy') {
        activeCallIdRef.current = null;
        Alert.alert('Call unavailable', event.reason || 'Participants are busy at the moment.');
        return;
      }
      if (event.event === 'BUSY') {
        const eventRoomId =
          typeof event.roomId === 'number' ? event.roomId : Number(event.roomId ?? roomId);
        if (!roomId || Number.isNaN(eventRoomId) || eventRoomId !== roomId) {
          return;
        }
        activeCallIdRef.current = null;
        if (Array.isArray(event.users) && event.users.length) {
          Alert.alert('Call unavailable', 'Some participants are already in another call.');
        }
      }
    },
    [roomId],
  );

  const { sendInviteDefault: sendRoomCallInvite } = useCallSignalingHook({
    roomId: roomId ?? null,
    onRoomEvent: handleCallRoomEvent,
    onQueueEvent: handleQueueEvent,
  });
  
  const pickAndSendFile = async () => {
  try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (res.type === 'cancel') return;
      const nowIso = new Date().toISOString();

      const file = {
        id: createLocalMessageId(),
        text: `📄 ${res.name}`,
        uri: res.uri,
        name: res.name,
        mimeType: res.mimeType,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        serverTs: nowIso,
        sender: 'me',
        isFile: true,
        pending: true,
      };

      setLocalMessages(prev => [...prev, file]);
    } catch (err) {
      console.warn('File picker error:', err);
    }
  };
  const openCamera = () => {
    setAttachMenuVisible(false);
    router.push({
      pathname: '/screens/CameraScreen',
      params: {
        returnTo: '/screens/MediaComposerScreen',
        chatReturnTo: '/screens/ChatDetailScreen',
        ...(roomId ? { roomId: String(roomId) } : {}),
        ...(roomKey ? { roomKey: String(roomKey) } : {}),
        ...(chatTitle ? { title: String(chatTitle) } : {}),
        ...(peerId ? { peerId: String(peerId) } : {}),
        ...(avatarUri ? { image: String(avatarUri) } : {}),
        ...(phoneNumber ? { phone: String(phoneNumber) } : {}),
      },
    });
  };

  const hideOverlay = () => {
    setSelectedListId(null);
    setShowListPicker(false);
    setAttachMenuVisible(false);
  };

  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus?.();
    });
  }, []);

  const normalizeSubQuantities = useCallback(raw => {
    if (!raw) return [];

    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        return parsed
          .map(sub => ({
            quantity: sub?.quantity ?? sub?.qty ?? '',
            priceText: sub?.priceText ?? sub?.price ?? '',
          }))
          .filter(sub => sub.quantity || sub.priceText);
      }
    } catch (err) {
      console.warn('Failed to parse sub quantities', err);
    }

    return [];
  }, []);

  const normalizeItems = useCallback(items => {
    if (!Array.isArray(items)) return [];

    return items.map(item => {
      const subQuantities = normalizeSubQuantities(item?.subQuantities ?? item?.subQuantitiesJson);
      return {
        id: item?.id != null ? String(item.id) : undefined,
        itemName: item?.itemName ?? 'Item',
        quantity: item?.quantity ?? '',
        priceText: item?.priceText ?? '',
        subQuantities,
      };
    });
  }, [normalizeSubQuantities]);

  const buildTodoState = useCallback(items => (
    items.map(item => ({
      checked: false,
      expanded: false,
      count: 1,
      subChecked: (item.subQuantities ?? []).map(() => false),
    }))
  ), []);

  const fetchSharedLists = useCallback(async () => {
    console.log('[ChatDetailScreen] fetchSharedLists inputs', { currentUserId, phoneNumber });
    if (!currentUserId || !phoneNumber) {
      setSharedListError('Missing user information to load shared lists.');
      setSharedLists([]);
      return;
    }

    setSharedListError(null);
    const cachedLists = await loadSharedListsFromDatabase();
    if (cachedLists.length) {
      setSharedLists(cachedLists);
    }
    setSharedListsLoading(cachedLists.length === 0);
    try {
      console.log('[ChatDetailScreen] fetchSharedLists calling API', { currentUserId, phoneNumber });
      const { data } = await apiClient.get('/api/lists/shared', {
        headers: { 'X-User-Id': String(currentUserId) },
        params: { phoneNumber },
      });

      const normalizedLists = (Array.isArray(data) ? data : [])
        .map(list => ({
          id: list?.id != null ? String(list.id) : null,
          title: list?.title ?? 'Untitled List',
        }))
        .filter(list => list.id);

      setSharedLists(normalizedLists);
      try {
        await initializeDatabase();
        const memberPhone = phoneNumber ? String(phoneNumber) : null;

        for (const entry of normalizedLists) {
          if (!entry?.id) continue;

          await saveListSummaryToDb({
            id: String(entry.id),
            title: entry.title ?? 'Untitled List',
            // Mark this list as shared with the current chat peer.
            members: memberPhone ? [{ phone: memberPhone }] : null,
            // Keep other fields empty; they'll be filled by fetchSelectedList.
            listType: null,
            createdAt: null,
            updatedAt: null,
            createdByUserId: null,
            description: null,
          });
        }
      } catch (dbError) {
        console.error('Failed to cache shared list headers', dbError);
      }
    } catch (err) {
      console.error('Failed to fetch shared lists', err);
      if (!cachedLists.length) {
        setSharedListError('Unable to load shared lists. Pull to retry.');
      }
    } finally {
      setSharedListsLoading(false);
    }
  }, [currentUserId, loadSharedListsFromDatabase, phoneNumber]);

  const fetchSelectedList = useCallback(async listId => {
    console.log('[ChatDetailScreen] fetchSelectedList inputs', { listId, currentUserId, phoneNumber });
    if (!listId || !currentUserId || !phoneNumber) {
      setSelectedListError('Missing user information to load list details.');
      return;
    }

    setSelectedListError(null);
    const cachedList = await loadSelectedListFromDatabase(listId);
    if (cachedList) {
      setSelectedListData(cachedList);
      setTodoState(buildTodoState(cachedList.items ?? []));
    }
    setIsSelectedListLoading(!cachedList);
    try {
      console.log('[ChatDetailScreen] fetchSelectedList calling API', { listId, currentUserId, phoneNumber });
      const { data } = await apiClient.get(`/api/lists/${encodeURIComponent(listId)}/shared`, {
        headers: { 'X-User-Id': String(currentUserId) },
        params: { phoneNumber },
      });

      const normalizedItems = normalizeItems(data?.items ?? []);
      const normalizedList = {
        id: data?.id != null ? String(data.id) : String(listId),
        title: data?.title ?? 'Shared List',
        items: normalizedItems,
      };

      setSelectedListData(normalizedList);
      setTodoState(buildTodoState(normalizedItems));

      try {
        await initializeDatabase();
        await saveListSummaryToDb({
          id: normalizedList.id,
          title: normalizedList.title,
          listType: data?.listType ?? null,
          createdAt: data?.createdAt ?? null,
          updatedAt: data?.updatedAt ?? null,
          createdByUserId:
            data?.createdByUserId != null ? String(data.createdByUserId) : null,
          description: data?.description ?? null,
          members: Array.isArray(data?.members) ? data.members : null,
          items: normalizedItems,
        });
      } catch (dbError) {
        console.error('Failed to cache shared list', dbError);
      }
    } catch (err) {
      console.error('Failed to fetch shared list', err);
      if (!cachedList) {
        setSelectedListError('Unable to load this list right now.');
        setSelectedListData(null);
        setTodoState([]);
      }
    } finally {
      setIsSelectedListLoading(false);
    }
   }, [
    buildTodoState,
    currentUserId,
    loadSelectedListFromDatabase,
    normalizeItems,
    phoneNumber,
  ]);

  const [todoState, setTodoState] = useState([]);
  const isDetailedTodoList = useMemo(() => {
    const items = selectedListData?.items ?? [];
    return items.some(
      item =>
        item?.quantity ||
        item?.priceText ||
        (item?.subQuantities?.length ?? 0) > 0,
    );
  }, [selectedListData]);

  useEffect(() => {
    if (showListPicker && !selectedListId && !sharedListsLoading && !hasFetchedSharedLists) {
      setHasFetchedSharedLists(true);
      fetchSharedLists();
    }
  }, [fetchSharedLists, hasFetchedSharedLists, selectedListId, sharedListsLoading, showListPicker]);

  useEffect(() => {
    if (!showListPicker) {
      setHasFetchedSharedLists(false);
    }
  }, [showListPicker]);

  useEffect(() => {
    setHasFetchedSharedLists(false);
    setSharedLists([]);
  }, [currentUserId, phoneNumber]);

  useEffect(() => {
    let cancelled = false;
    if (!phoneNumber) {
      return undefined;
    }

    loadSharedListsFromDatabase()
      .then(lists => {
        if (!cancelled && lists.length) {
          setSharedLists(lists);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [loadSharedListsFromDatabase, phoneNumber]);

  useEffect(() => {
    if (!selectedListId) {
      setSelectedListData(null);
      setTodoState([]);
      return;
    }

    fetchSelectedList(selectedListId);
  }, [fetchSelectedList, selectedListId]);

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  useEffect(() => {
    notifyTyping(Boolean(input.trim()));
    return () => {
      notifyTyping(false);
    };
  }, [input, notifyTyping]);

  useEffect(() => {
    if (!messages.length) {
      return;
    }
    const last = messages[messages.length - 1];
    if (last?.sender === 'other') {
      markLatestRead();
    }
  }, [messages, markLatestRead]);



  const inferMimeType = useCallback(uri => {
    const normalized = (uri || '').toLowerCase();
    if (normalized.endsWith('.png')) return 'image/png';
    if (normalized.endsWith('.webp')) return 'image/webp';
    if (normalized.endsWith('.heic') || normalized.endsWith('.heif')) return 'image/heic';
    return 'image/jpeg';
  }, []);

  const uploadImageToMediaStore = useCallback(async uri => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const contentType = blob.type || inferMimeType(uri);
    const intent = await apiClient.post('/api/media/uploads', {
      contentType,
      sizeBytes: blob.size,
      resumable: false,
    });
    const { mediaId, putUrl } = intent.data || {};
    if (!mediaId || !putUrl) {
      throw new Error('Upload intent missing media details');
    }

    const putResponse = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
    if (!putResponse.ok) {
      throw new Error(`Upload failed with status ${putResponse.status}`);
    }

    await apiClient.post(`/api/media/${mediaId}/complete`);
    const urlResponse = await apiClient.get(`/api/media/${mediaId}/urls`);
    const mediaUrls = urlResponse.data || {};
    if (!mediaUrls.original) {
      throw new Error('No media URL returned from backend');
    }
    return {
      mediaId,
      url: mediaUrls.original,
      thumbUrl: mediaUrls.thumb || null,
      contentType,
      width: mediaUrls.width || null,
      height: mediaUrls.height || null,
    };
  }, [inferMimeType]);

  useEffect(() => {
    if (!paramLocation || !roomId) {
      return;
    }
    const rawLocation = Array.isArray(paramLocation) ? paramLocation[0] : paramLocation;
    if (!rawLocation || rawLocation === lastLocationRef.current) {
      return;
    }
    let parsedLocation = null;
    try {
      parsedLocation = JSON.parse(rawLocation);
    } catch (error) {
      console.warn('Failed to parse location payload', error);
      return;
    }
    const latitude = Number(parsedLocation?.coords?.latitude);
    const longitude = Number(parsedLocation?.coords?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }
    lastLocationRef.current = rawLocation;
    navigation.setParams({ location: undefined });
    const locationPayload = JSON.stringify({
      type: 'location',
      coords: { latitude, longitude },
      url:
        parsedLocation?.url ??
        `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`,
    });
    sendTextMessage(locationPayload).catch(err => {
      console.warn('Send location error:', err);
    });
  }, [navigation, paramLocation, roomId, sendTextMessage]);



  useEffect(() => {
    if (!paramMediaPayload || !roomId) {
      return;
    }
    const rawPayload = Array.isArray(paramMediaPayload) ? paramMediaPayload[0] : paramMediaPayload;
    if (!rawPayload || rawPayload === lastMediaPayloadRef.current) {
      return;
    }

    let parsedPayload = null;
    try {
      parsedPayload = JSON.parse(rawPayload);
    } catch (error) {
      console.warn('Failed to parse media payload', error);
      return;
    }
    const selectedMedia = Array.isArray(parsedPayload?.media)
      ? parsedPayload.media.filter(Boolean)
      : [];
    if (!selectedMedia.length) {
      return;
    }

    lastMediaPayloadRef.current = rawPayload;
    navigation.setParams({ mediaPayload: undefined });

    (async () => {
      try {
        const uploadedMedia = [];
        for (const uri of selectedMedia) {
          const uploaded = await uploadImageToMediaStore(uri);
          uploadedMedia.push(uploaded);
        }

        const encryptedMetadata = JSON.stringify({
          type: 'image',
          media: uploadedMedia,
          caption: typeof parsedPayload?.caption === 'string' ? parsedPayload.caption.trim() : '',
        });
        await sendImageMessage(encryptedMetadata);
      } catch (err) {
        console.warn('Send image error:', err);
        Alert.alert('Media upload failed', 'Unable to send one or more images. Please try again.');
      }
    })();
  }, [navigation, paramMediaPayload, roomId, sendImageMessage, uploadImageToMediaStore]);

  useEffect(() => {
    const onFocus = () => {
      const currentRoute = navigation
        ?.getState?.()
        ?.routes?.find(r => r.key === route.key);
      const pendingPreview = currentRoute?.params?.pendingTodoPreview;
      const resumeSelectedListId = currentRoute?.params?.resumeSelectedListId;
      const resumeShowListPicker = currentRoute?.params?.resumeShowListPicker;
      const closeTodoOverlay = currentRoute?.params?.closeTodoOverlay;

      if (resumeSelectedListId || resumeShowListPicker || closeTodoOverlay) {
        navigation.setParams({
          resumeSelectedListId: undefined,
          resumeShowListPicker: undefined,
          closeTodoOverlay: undefined,
        });
      }

      if (closeTodoOverlay) {
        setShowListPicker(false);
        setSelectedListId(null);
      }

      if (resumeSelectedListId) {
        setSelectedListId(resumeSelectedListId);
        setShowListPicker(false);
      } else if (resumeShowListPicker) {
        setShowListPicker(true);
      }

      if (!pendingPreview) {
        return;
      }

      navigation.setParams({
        pendingTodoPreview: undefined,
        resumeSelectedListId: undefined,
        resumeShowListPicker: undefined,
        closeTodoOverlay: undefined,
      });
      setShowListPicker(false);
      setSelectedListId(null);
      return;
    };

    const unsubscribe = navigation.addListener('focus', onFocus);
    return unsubscribe;
  }, [navigation, route.key, roomId, selectedListId, clearSelection, createLocalMessageId]);

  const clearSelection = useCallback(() => {
    setSelectedMessages([]);
    setMoreMenuVisible(false);
  }, []);

  useEffect(() => {
    setLocalMessages([]);
    setDeletedMessageIds([]);
    setDeletedForEveryoneIds([]);
    clearSelection();
  }, [roomId, roomKey, clearSelection]);

  useEffect(() => {
    setSelectedMessages(prev => prev.filter(msg => messages.find(m => m.id === msg.id)));
  }, [messages]);

  useEffect(() => {
    if (!selectedMessages.length) {
      setMoreMenuVisible(false);
    }
  }, [selectedMessages.length]);

  const sendCurrentMessage = async () => {
    const txt = input.trim();
    if (!txt) return;

    const outgoingText = replyTo
      ? JSON.stringify({
          type: 'reply',
          replyTo: {
            messageId: replyTo.messageId,
            senderId: replyTo.senderId,
            senderLabel: replyTo.senderLabel,
            previewText: replyTo.previewText,
            isMine: replyTo.isMine,
          },
          body: txt,
        })
      : txt;

    try {
      await sendTextMessage(outgoingText, replyTo);
      setInput('');
      if (replyTo) setReplyTo(null);
    } catch (err) {
      console.warn('Send message error:', err);
    }
  };

  const handleReply = () => {
    if (selectedMessages.length !== 1) {
      Alert.alert('Select one message', 'Please select a single message to reply.');
      return;
    }
    const [selectedMessage] = selectedMessages;
    beginReply(selectedMessage);
  };

  const cancelReply = useCallback(() => {
    setReplyTo(null);
    focusComposer();
  }, [focusComposer]);

  const handleDeleteSelected = () => {
    if (!selectedMessages.length) return;
    setPendingDeleteMessages(selectedMessages);
    setDeleteModalVisible(true);
  };
  const closeDeleteModal = () => {
    setDeleteModalVisible(false);
    setPendingDeleteMessages([]);
  };
  const canDeleteForEveryone =
    pendingDeleteMessages.length > 0 && pendingDeleteMessages.every(msg => msg.sender === 'me');
  const deleteModalTitle =
    pendingDeleteMessages.length > 1 ? 'Delete messages?' : 'Delete message?';
  const applyDeleteForMe = async () => {
    if (!pendingDeleteMessages.length) return;
    const targetIds = pendingDeleteMessages.map(message => message.id);
    const persistedIds = targetIds.filter(id => id && !String(id).startsWith('local-'));
    setDeletedMessageIds(prev => {
      const idSet = new Set(prev);
      targetIds.forEach(id => idSet.add(id));
      return Array.from(idSet);
    });
    closeDeleteModal();
    clearSelection();
    try {
      await deleteMessagesFromDb(persistedIds);
      await Promise.all(
        persistedIds
          .map(id => deleteMessageForMe(id)),
      );
    } catch (err) {
      console.warn('Delete for me failed', err);
      Alert.alert('Delete failed', 'Unable to delete the message for you.');
    }
  };
  const applyDeleteForEveryone = async () => {
    if (!pendingDeleteMessages.length) return;
    const targetIds = pendingDeleteMessages.map(message => message.id);
    const persistedIds = targetIds.filter(id => id && !String(id).startsWith('local-'));
    setDeletedForEveryoneIds(prev => {
      const idSet = new Set(prev);
      targetIds.forEach(id => idSet.add(id));
      return Array.from(idSet);
    });
    closeDeleteModal();
    clearSelection();
    try {
      await Promise.all(
        persistedIds.map(id =>
          updateMessageDeletionInDb(id, {
            deletedForEveryone: true,
          }),
        ),
      );
      await Promise.all(
        persistedIds
          .map(id => deleteMessageForEveryone(id)),
      );
    } catch (err) {
      console.warn('Delete for everyone failed', err);
      Alert.alert('Delete failed', 'Unable to delete the message for everyone.');
    }
  };

  const handleCopySelected = async () => {
    const textMessages = selectedMessages.filter(m => m.text);
    if (!textMessages.length) {
      Alert.alert('Copy unavailable', 'Only text messages can be copied.');
      setMoreMenuVisible(false);
      return;
    }
    try {
      await Clipboard.setStringAsync(textMessages.map(m => m.text).join('\n'));
      Alert.alert('Copied', 'Message copied to clipboard.');
    } catch (err) {
      console.warn('Copy message error:', err);
    } finally {
      setMoreMenuVisible(false);
    }
  };

  const handleForwardSelected = () => {
    if (!selectedMessages.length) return;
    Alert.alert('Forward', 'Forward message action triggered.');
    clearSelection();
  };

  const handleInfo = () => {
    Alert.alert('Message info', 'Info option selected.');
    setMoreMenuVisible(false);
  };

  const handlePin = () => {
    Alert.alert('Pinned', 'Message pinned.');
    setMoreMenuVisible(false);
  };

  const handleTranslate = () => {
    Alert.alert('Translate', 'Translate option selected.');
    setMoreMenuVisible(false);
  };

  function parseQty(qtyStr) {
    const m = /^([\d.]+)\s*(kg|kgs?|g|gm|gms?|pcs?|ps)$/i.exec(qtyStr ?? '');
    if (!m) return null;
    const value = parseFloat(m[1]);
    const unitKey = m[2].toLowerCase();
    const unitMap = {
      kg: 'kg',
      kgs: 'kg',
      g: 'g',
      gm: 'g',
      gms: 'g',
      pcs: 'ps',
      ps: 'ps',
    };
    return { value, unit: unitMap[unitKey] ?? unitKey };
  }

  const bottomOffset = insets.bottom + MARGIN * 2;

  // toggles ...
  const toggleCheck = i => setTodoState(s => { const c=[...s]; c[i].checked=!c[i].checked; return c; });
  const toggleExpand = i => setTodoState(s => { const c=[...s]; c[i].expanded=!c[i].expanded; return c; });
  const inc = i => setTodoState(s => { const c=[...s]; c[i].count++; return c; });
  const dec = i => setTodoState(s => { const c=[...s]; if(c[i].count>1)c[i].count--; return c; });
  const toggleSubCheck = (i, si) =>
    setTodoState(s => {
      const c = [...s];
      c[i].subChecked = [...c[i].subChecked];
      c[i].subChecked[si] = !c[i].subChecked[si];
      return c;
    });

  const renderTodoItem = ({ item, index }) => {
    const subQuantities = item.subQuantities ?? [];
    const st = todoState[index] ?? {
      checked: false,
      expanded: false,
      count: 1,
      subChecked: subQuantities.map(() => false),
    };
    const showSubQuantities = subQuantities.length > 0;
    const unitPrice = parseInt((item.priceText ?? '').replace(/[^0-9]/gm, ''), 10) || 0;
    const displayedPrice = st.checked && unitPrice ? `₹${unitPrice * st.count}` : (item.priceText ?? '');

    return (
      <View>
        <View style={styles.todoRow}>
          <View style={styles.todoLeft}>
            <TouchableOpacity onPress={() => toggleCheck(index)} style={{ marginRight: 8 }}>
              <Icon name={st.checked ? 'check-box' : 'check-box-outline-blank'} size={24} color="#1f6ea7" />
            </TouchableOpacity>
            {showSubQuantities ? (
              <TouchableOpacity onPress={() => toggleExpand(index)} style={{ marginRight: 8 }}>
                <Icon name={st.expanded ? 'arrow-drop-up' : 'arrow-drop-down'} size={28} color="#333" />
              </TouchableOpacity>
            ) : null}
            <Text style={styles.todoTitle}>{item.itemName}</Text>
          </View>
          {isDetailedTodoList ? (
            <View style={styles.todoRight}>
              <Text style={styles.todoQty}>× {item.quantity || ''}</Text>
              {st.checked && unitPrice ? (
                <View style={styles.counter}>
                  <TouchableOpacity onPress={() => dec(index)}>
                    <Text style={styles.counterBtn}>–</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterLabel}>{st.count}</Text>
                  <TouchableOpacity onPress={() => inc(index)}>
                    <Text style={styles.counterBtn1}>＋</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <Text style={styles.todoPrice}>{displayedPrice}</Text>
            </View>
          ) : null}
        </View>

        {showSubQuantities && st.expanded && (
          <View style={styles.subContainer}>
            {subQuantities.map((sub, si) => (
              <View key={si} style={styles.subRow}>
                <View style={styles.todoLeft}>
                  <View style={{ width: 40 }} />
                  <TouchableOpacity onPress={() => toggleSubCheck(index, si)} style={{ marginRight: 8 }}>
                    <Icon
                      name={st.subChecked?.[si] ? 'check-box' : 'check-box-outline-blank'}
                      size={20}
                      color="#1f6ea7"
                    />
                  </TouchableOpacity>
                  <Text style={styles.todoTitle}>{sub.quantity}</Text>
                </View>
                <View style={styles.todoRight}>
                  <Text style={styles.todoQty} />
                  <Text style={styles.todoPrice}>{sub.priceText}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const anyChecked = todoState.some(e => e.checked);

  const stopPreviewPlayback = async () => {
      if (!previewSoundRef.current) return;
      try {
      await previewSoundRef.current.stopAsync();
      await previewSoundRef.current.setPositionAsync(0);
    } catch (err) {
      console.warn('Preview stop error:', err);
    }
    setIsPreviewPlaying(false);
  };

  const clearRecording = async () => {
    await stopPreviewPlayback();
    if (previewSoundRef.current) {
      try {
        await previewSoundRef.current.unloadAsync();
      } catch (err) {
        console.warn('Preview unload error:', err);
      }
      previewSoundRef.current = null;
    }
    setRecordedUri(null);
    setRecordingDuration(0);
    setIsPreviewPlaying(false);
  };

  const stopMessagePlayback = async () => {
    if (!playbackSoundRef.current) return;
    try {
      await playbackSoundRef.current.stopAsync();
      await playbackSoundRef.current.unloadAsync();
    } catch (err) {
      console.warn('Playback stop error:', err);
    }
    playbackSoundRef.current = null;
    setPlayingMessageId(null);
  };

  const requestAudioPermission = async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow microphone access to record audio.');
      return false;
    }
    return true;
  };

  const startRecording = async () => {
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) return;

    try {
      await stopMessagePlayback();
      await clearRecording();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        status => {
          if (status?.durationMillis != null) {
            setRecordingDuration(status.durationMillis);
          }
        },
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err) {
      console.warn('Start recording error:', err);
      setIsRecording(false);
      recordingRef.current = null;
    }
  };

  const stopRecording = async shouldSave => {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    setIsRecording(false);

    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      if (shouldSave) {
        setRecordingDuration(status?.durationMillis ?? recordingDuration);
        setRecordedUri(recording.getURI());
      } else {
        setRecordingDuration(0);
        setRecordedUri(null);
      }
    } catch (err) {
      console.warn('Stop recording error:', err);
      setRecordedUri(null);
    }
  };

  const togglePreviewPlayback = async () => {
    if (!recordedUri) return;
    try {
      await stopMessagePlayback();
      if (isPreviewPlaying && previewSoundRef.current) {
        await previewSoundRef.current.stopAsync();
        await previewSoundRef.current.setPositionAsync(0);
        setIsPreviewPlaying(false);
        return;
      }

      if (!previewSoundRef.current) {
        const { sound } = await Audio.Sound.createAsync({ uri: recordedUri });
        previewSoundRef.current = sound;
        sound.setOnPlaybackStatusUpdate(status => {
          if (status.didJustFinish) {
            setIsPreviewPlaying(false);
            sound.setPositionAsync(0).catch(() => {});
          }
        });
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      await previewSoundRef.current.replayAsync();
      setIsPreviewPlaying(true);
    } catch (err) {
      console.warn('Preview playback error:', err);
      setIsPreviewPlaying(false);
    }
  };

  const sendAudioMessage = async () => {
    if (!recordedUri) return;
    const duration = recordingDuration;
    const uri = recordedUri;
    const nowIso = new Date().toISOString();
    setLocalMessages(prev => [
      ...prev,
      {
        id: createLocalMessageId(),
        audio: uri,
        duration,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        serverTs: nowIso,
        sender: 'me',
        pending: true,
      },
    ]);
    await clearRecording();
  };

  const toggleMessagePlayback = async message => {
    if (!message.audio) return;

    try {
      if (playingMessageId === message.id && playbackSoundRef.current) {
        await stopMessagePlayback();
        return;
      }

      await stopMessagePlayback();
      await stopPreviewPlayback();
      if (previewSoundRef.current) {
        await previewSoundRef.current.unloadAsync();
        previewSoundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync({ uri: message.audio });
      playbackSoundRef.current = sound;
      setPlayingMessageId(message.id);
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish) {
          stopMessagePlayback().catch(() => {});
        }
      });
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      await sound.playAsync();
    } catch (err) {
      console.warn('Message playback error:', err);
      await stopMessagePlayback();
    }
  };

  const handlePrimaryAction = async () => {
    if (input.trim()) {
      sendCurrentMessage();
      return;
    }

    if (isRecording) {
      await stopRecording(true);
      return;
    }

    if (recordedUri) {
      await sendAudioMessage();
      return;
    }

    await startRecording();
  };

  const handleDiscardRecording = async () => {
    if (isRecording) {
      await stopRecording(false);
      await clearRecording();
    } else {
      await clearRecording();
    }
  };

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      if (previewSoundRef.current) {
        previewSoundRef.current.unloadAsync().catch(() => {});
        previewSoundRef.current = null;
      }
      if (playbackSoundRef.current) {
        playbackSoundRef.current.unloadAsync().catch(() => {});
        playbackSoundRef.current = null;
      }
    };
  }, []);

  const onAttach = async key => {
    setAttachMenuVisible(false);
    setSelectedListId(null);

    switch (key) {
      case 'photos':
        return router.push('/screens/PhotoPickerScreen');
      case 'files':
        return pickAndSendFile();
      case 'location':
        return router.push({
          pathname: '/screens/LocationPickerScreen',
          params: {
            roomId: roomId != null ? String(roomId) : undefined,
            roomKey: roomKey ?? undefined,
            peerId: peerId != null ? String(peerId) : undefined,
            phone: phoneNumber || undefined,
            title: chatTitle,
            ...(avatarUri ? { image: avatarUri } : {}),
          },
        });
      case 'music':
        return router.push('/screens/AudioPickerScreen');
      case 'contacts':
        return router.push('/screens/ContactPickerScreen');
      case 'camera':
        return openCamera();
    }
  };

  const topInset = Platform.OS === 'android' ? 0 : insets.top;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#1f6ea7" barStyle="light-content" />

      {/* Header */}
       {isRoomReady ? (
        <>
          {/* Header */}
          <View
            style={[
              styles.header,
              { paddingTop: topInset, minHeight: BAR_HEIGHT + topInset },
            ]}
          >
             <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/screens/MocScreen');
              }}
              style={styles.iconBtn}
            >
              <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
           {!selectedMessages.length ? (
              <>
                {avatarSource ? (
                  <Image source={avatarSource} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Icon name="person" size={24} color="#7a7a7a" />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.titleContainer}
                  onPress={() => {
                    const media = filteredMessages.filter(m => m.image).map(m => m.image);
                    router.push({
                      pathname: '/screens/ContactProfileScreen',
                      params: {
                        name: chatTitle,
                         ...(avatarUri ? { image: avatarUri } : {}),
                        phone: params?.phone ? String(params.phone) : '',
                        media: JSON.stringify(media),
                      },
                    });
                  }}
                >
                  <Text style={styles.headerTitle}>{chatTitle}</Text>
                  <Text style={styles.headerSubtitle}>{subtitleText}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <View style={styles.headerActions}>
             {selectedMessages.length? (
                <>
                <Text style={styles.selectionCount}>{selectedMessages.length}</Text>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleReply}>
                    <Icon name="reply" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleDeleteSelected}>
                    <Icon name="delete" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleCopySelected}>
                    <Icon name="content-copy" size={22} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleForwardSelected}>
                    <Icon
                      name="reply"
                      size={24}
                      color="#fff"
                      style={{ transform: [{ scaleX: -1 }] }} // flip horizontally
                    />
                  </TouchableOpacity>
                  <View style={styles.moreMenuWrapper}>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => setMoreMenuVisible(v => !v)}
                    >
                      <Icon name="more-vert" size={24} color="#fff" />
                    </TouchableOpacity>
                    {moreMenuVisible ? (
                      <View style={styles.moreMenu}>
                        <TouchableOpacity style={styles.moreMenuItem} onPress={handleInfo}>
                          <Text style={styles.moreMenuText}>Info</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.moreMenuItem} onPress={handleCopySelected}>
                          <Text style={styles.moreMenuText}>Copy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.moreMenuItem} onPress={handlePin}>
                          <Text style={styles.moreMenuText}>Pin</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.moreMenuItem} onPress={handleTranslate}>
                          <Text style={styles.moreMenuText}>Translate</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() =>
                      router.push({
                        pathname: '/screens/VideoCallScreen',
                        params: {
                          name: chatTitle,
                          image: avatarUri,
                        },
                      })
                    }
                  >
                  <Icon name="videocam" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={async () => {
                      if (!roomId || !peerId) {
                        Alert.alert('Call unavailable', 'This chat is not ready for calling yet.');
                        return;
                      }
                      if (activeCallIdRef.current && activeCallIdRef.current !== 'pending') {
                        return;
                      }
                      activeCallIdRef.current = 'pending';
                      try {
                        await sendRoomCallInvite([peerId]);
                      } catch (err) {
                        activeCallIdRef.current = null;
                        console.warn('Failed to start voice call', err);
                        Alert.alert('Call failed', 'Unable to start the call. Please try again.');
                      } finally {
                        setTimeout(() => {
                          if (activeCallIdRef.current === 'pending') {
                            activeCallIdRef.current = null;
                          }
                        }, 10000);        
                      }
                       }}
                  >
                    <Icon name="call" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn}>
                    <Icon name="more-vert" size={24} color="#fff" />
              </TouchableOpacity>
               </>
              )}
            </View>
          </View>

      {/* Chat messages */}
          {historyError ? (
            <View style={styles.historyErrorBanner}>
              <Text style={styles.historyErrorText}>{historyError}</Text>
            </View>
          ) : null}
          <FlatList
            ref={flatListRef}
            data={chatItems}
            keyExtractor={i => i.id}
            contentContainerStyle={{
              padding: 12,
              paddingBottom: MESSAGE_BAR_HEIGHT + bottomOffset + replyBarHeight,
            }}
            ListEmptyComponent={
              isHistoryLoading ? (
                <View style={styles.historyLoading}>
                  <ActivityIndicator color="#1f6ea7" />
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              if (item.kind === 'date') {
                return (
                  <View style={styles.dateSeparatorRow}>
                    <Text style={styles.dateSeparatorText}>{item.label}</Text>
                  </View>
                );
              }

              const msg = item.msg;
              const isSelected = selectedMessages.some(m => m.id === msg.id);
              const tableMessage = isTableMessage(msg.text ?? msg?.raw?.body ?? null);
              const isDecryptionPlaceholder =
                (msg?.text ?? msg?.raw?.body ?? null) === DECRYPTION_PENDING_TEXT;
              const showWaitingBubble =
                Boolean(msg?.raw?.decryptionFailed) ||
                Boolean(msg?.failed) ||
                isDecryptionPlaceholder;
              const replyMeta = getReplyMetaForMessage(msg);
                const deletedForEveryone = isDeletedForEveryone(msg);
                const deletedLabel =
                  msg.sender === 'me' ? 'You deleted this message' : DELETED_MESSAGE_TEXT;
                const translateX = getSwipeTranslateX(msg.id);
                const replyIconOpacity = translateX.interpolate({
                  inputRange: [0, SWIPE_ICON_THRESHOLD, SWIPE_MAX_DISTANCE],
                  outputRange: [0, 0.6, 1],
                  extrapolate: 'clamp',
                });
                const replyIconScale = translateX.interpolate({
                  inputRange: [0, SWIPE_ICON_THRESHOLD, SWIPE_MAX_DISTANCE],
                  outputRange: [0.6, 0.9, 1],
                  extrapolate: 'clamp',
                });
                const panResponder = PanResponder.create({
                onMoveShouldSetPanResponder: (_, gesture) => {
                  if (selectedMessages.length) {
                    return false;
                  }
                  const { dx, dy } = gesture;
                  return dx > SWIPE_START_THRESHOLD && Math.abs(dx) > Math.abs(dy);
                },
                onPanResponderMove: (_, gesture) => {
                  if (gesture.dx <= 0) {
                    return;
                  }
                  const clampedDx = Math.min(gesture.dx, SWIPE_MAX_DISTANCE);
                  translateX.setValue(clampedDx);
                },
                onPanResponderRelease: (_, gesture) => {
                  const shouldReply = gesture.dx > SWIPE_REPLY_THRESHOLD;
                  resetSwipe(translateX, shouldReply ? () => beginReply(msg) : null);
                },
                onPanResponderTerminate: () => {
                  resetSwipe(translateX);
                },
                onPanResponderTerminationRequest: () => true,
              });
              return (
                <View style={styles.messageSwipeContainer}>
                  <View
                    style={[
                      styles.replySwipeIconContainer,
                      msg.sender === 'me'
                        ? styles.replySwipeIconContainerOutgoing
                        : styles.replySwipeIconContainerIncoming,
                    ]}
                  >
                  <Animated.View
                      style={{
                        opacity: replyIconOpacity,
                        transform: [{ scale: replyIconScale }],
                      }}
                    >
                      <Icon name="reply" size={18} color="#1f6ea7" />
                    </Animated.View>
                  </View>
                <Animated.View
                    style={[
                      styles.messageSwipeContent,
                      { transform: [{ translateX }] },
                    ]}
                    {...panResponder.panHandlers}
                  >
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onLongPress={() => {
                        setSelectedMessages(prev => {
                          if (prev.some(m => m.id === msg.id)) return prev;
                          return [...prev, msg];
                        });
                        setMoreMenuVisible(false);
                      }}
                      onPress={() => {
                        if (selectedMessages.length) {
                          setSelectedMessages(prev => {
                            const exists = prev.some(m => m.id === msg.id);
                            if (exists) {
                              return prev.filter(m => m.id !== msg.id);
                            }
                            return [...prev, msg];
                          });
                        }
                      }}
                      style={[
                        styles.messageRow,
                        msg.sender === 'me' ? styles.messageRowOutgoing : styles.messageRowIncoming,
                        isSelected ? styles.selectedRow : null,
                      ]}
                    >
                      <View
                        style={[
                          styles.bubble,
                          tableMessage ? styles.tableBubble : null,
                          deletedForEveryone ? styles.deletedBubble : null,
                          showWaitingBubble ? styles.waitingBubble : null,
                          msg.sender === 'me' ? styles.myBubble : styles.theirBubble,
                          msg.failed ? styles.failedBubble : null,
                          isSelected ? styles.selectedBubble : null,
                        ]}
                      >
                        <MessageContent
                          item={msg}
                          playingMessageId={playingMessageId}
                          onTogglePlayback={toggleMessagePlayback}
                          onRetryDecrypt={retryDecryptMessage}
                          deletedForEveryone={deletedForEveryone}
                          deletedLabel={deletedLabel}
                          replyMeta={replyMeta}
                        />
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              );
            }}
          />

          <Modal
        transparent
        animationType="fade"
        visible={deleteModalVisible}
        onRequestClose={closeDeleteModal}
      >
        <Pressable style={styles.deleteModalBackdrop} onPress={closeDeleteModal}>
          <Pressable style={styles.deleteModalCard} onPress={() => {}}>
            <Text style={styles.deleteModalTitle}>{deleteModalTitle}</Text>
            {canDeleteForEveryone ? (
              <TouchableOpacity style={styles.deleteModalOption} onPress={applyDeleteForEveryone}>
                <Text style={styles.deleteModalOptionText}>Delete for everyone</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.deleteModalOption} onPress={applyDeleteForMe}>
              <Text style={styles.deleteModalOptionText}>Delete for me</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteModalOption} onPress={closeDeleteModal}>
              <Text style={styles.deleteModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Attach grid */}
      {attachMenuVisible && (
        <>
          <TouchableOpacity style={styles.attachOverlay} onPress={() => setAttachMenuVisible(false)} />
          <View style={[styles.attachGrid, { bottom: insets.bottom + MESSAGE_BAR_HEIGHT + MARGIN }]}>
            {[
              ['photos', 'photo'],
              ['files', 'insert-drive-file'],
              ['camera', 'camera-alt'],
              ['location', 'location-on'],
              ['music', 'music-note'],
              ['contacts', 'account-circle'],
            ].map(([key, icon]) => (
              <TouchableOpacity key={key} style={styles.attachItem} onPress={() => onAttach(key)}>
                <View style={styles.attachCircle}>
                  <Icon name={icon} size={24} color="#fff" />
                </View>
                <Text style={styles.attachLabel}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* List picker */}
      {showListPicker && !selectedListId && (
        <View style={[styles.listPickerContainer, { bottom: MESSAGE_BAR_HEIGHT + bottomOffset }]}>
          <View style={styles.arrowDown} />
          <View style={styles.listPicker}>
            {sharedListsLoading ? (
              <ActivityIndicator size="small" color="#1f6ea7" />
            ) : sharedListError ? (
              <Text style={styles.listText}>{sharedListError}</Text>
            ) : sharedLists.length ? (
              sharedLists.map(l => (
                <TouchableOpacity
                  key={l.id}
                  style={styles.listItem}
                  onPress={() => {
                    setSelectedListId(l.id);
                    setShowListPicker(false);
                  }}>
                  <View style={styles.listBullet} />
                  <Text style={styles.listText}>{l.title}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.listText}>No shared lists available.</Text>
            )}
          </View>
        </View>
      )}

      {/* To‑Do overlay */}
      {selectedListId ? (
        <View style={[styles.todoOverlay, { bottom: MESSAGE_BAR_HEIGHT + bottomOffset }]}>
          <View style={styles.todoHeader}>
            <TouchableOpacity onPress={() => setSelectedListId(null)} style={{ padding: 8 }}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.todoHeaderTitle}>{selectedListData?.title ?? 'Shared List'}</Text>

            {isSelectedListLoading && <ActivityIndicator size="small" color="#1f6ea7" />}

            {anyChecked && selectedListData?.items?.length ? (
              <TouchableOpacity
                onPress={() => {
                  const previewItems = [];
                  const items = selectedListData?.items ?? [];

                  items.forEach((item, idx) => {
                    const st = todoState[idx];
                    if (!st?.checked && !(st?.subChecked ?? []).some(Boolean)) return;

                    if (!isDetailedTodoList) {
                      previewItems.push({
                        name: item.itemName,
                        checked: Boolean(st?.checked),
                      });
                      return;
                    }

                    const basePrice = parseInt((item.priceText ?? '').replace(/[^0-9]/g, ''), 10) || 0;
                    let total = 0;
                    if (st?.checked) total += basePrice * (st?.count ?? 1);
                    (item.subQuantities ?? []).forEach((sub, si) => {
                      if (st?.subChecked?.[si]) {
                        const subPrice = parseInt((sub.priceText ?? '').replace(/[^0-9]/g, ''), 10) || 0;
                        total += subPrice;
                      }
                    });

                    const unitTotals = {};
                    if (st?.checked) {
                      const base = parseQty(item.quantity ?? '');
                      if (base) unitTotals[base.unit] = (unitTotals[base.unit] || 0) + base.value * (st?.count ?? 1);
                    }
                    (item.subQuantities ?? []).forEach((sub, si) => {
                      if (st?.subChecked?.[si]) {
                        const pq = parseQty(sub.quantity ?? '');
                        if (pq) unitTotals[pq.unit] = (unitTotals[pq.unit] || 0) + pq.value;
                      }
                    });

                    const parts = [];
                    ['kg', 'g', 'ps'].forEach(u => {
                      const v = unitTotals[u];
                      if (v) {
                        const str = Number.isInteger(v) ? v : v.toFixed(2).replace(/\.?0+$/, '');
                        parts.push(`${str}${u}`);
                      }
                    });
                    const qtyText = parts.join(' + ');

                    previewItems.push({ name: item.itemName, qty: qtyText, price: `₹${total}` });
                  });

                  const previewPayload = isDetailedTodoList
                    ? { type: 'todo_table', title: selectedListData?.title ?? undefined, rows: previewItems }
                    : {
                        type: 'todo_list',
                        title: selectedListData?.title ?? undefined,
                        items: (selectedListData?.items ?? []).map((item, idx) => ({
                          name: item.itemName,
                          checked: Boolean(todoState[idx]?.checked),
                        })),
                      };

                  router.push({
                    pathname: '/screens/SelectedPreview',
                    params: {
                      preview: JSON.stringify(previewPayload),
                      roomId: roomId ?? undefined,
                      roomKey: roomKey ?? undefined,
                      peerId: peerId ?? undefined,
                      title: chatTitle ?? undefined,
                      listTitle: selectedListData?.title ?? undefined,
                      returnToKey: route?.key ?? undefined,
                      selectedListId: selectedListId ?? undefined,
                    },
                  });
                }}
                style={styles.previewBtn}
                >
                <Icon name="send" size={24} color="#1f6ea7" />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.headerDivider} />
          {isSelectedListLoading ? (
            <ActivityIndicator style={{ padding: 16 }} size="small" color="#1f6ea7" />
          ) : selectedListError ? (
            <Text style={[styles.listText, { padding: 16 }]}>{selectedListError}</Text>
          ) : selectedListData ? (
            <FlatList
              data={selectedListData.items}
              keyExtractor={(item, i) => item.id ?? i.toString()}
              renderItem={renderTodoItem}
              contentContainerStyle={{ paddingBottom: 12 }}
            />
          ) : null}
        </View>
      ): null}

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={BAR_HEIGHT + insets.top}
        style={{}}
      >
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: insets.bottom + MARGIN,
            },
         ]}
        >
          {(isRecording || recordedUri) && (
            <View style={styles.audioPreview}>
              <TouchableOpacity
                style={styles.previewPlayButton}
                onPress={() => (isRecording ? null : togglePreviewPlayback())}
                disabled={isRecording}
              >
                <Icon
                  name={
                    isRecording
                      ? 'fiber-manual-record'
                      : isPreviewPlaying
                        ? 'pause'
                        : 'play-arrow'
                  }
                  size={20}
                  color={isRecording ? '#d32f2f' : '#1f6ea7'}
                />
              </TouchableOpacity>
              <Text style={styles.previewDuration}>
                {isRecording
                  ? `Recording… ${formatDurationText(recordingDuration)}`
                  : formatDurationText(recordingDuration)}
              </Text>
              <TouchableOpacity style={styles.previewClose} onPress={handleDiscardRecording}>
                <Icon name="close" size={18} color="#333" />
              </TouchableOpacity>
            </View>
          )}

            {replyTo ? (
            <View
              style={styles.replyBar}
              onLayout={event => setReplyBarHeight(event.nativeEvent.layout.height)}
            >
              <View style={styles.replyBarStripe} />
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={focusComposer}
                style={styles.replyBarBody}
              >
                <Text style={styles.replyBarTitle}>{replyTo.senderLabel}</Text>
                <Text numberOfLines={1} style={styles.replyBarSubtitle}>
                  {replyTo.previewText}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={cancelReply} style={styles.replyBarClose}>
                <Icon name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>
          ) : replyBarHeight ? (
            <View onLayout={() => setReplyBarHeight(0)} />
          ) : null}

          <View style={styles.messageBarRow}>
            <View style={styles.messageBar}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  setAttachMenuVisible(v => !v);
                  setShowListPicker(false);
                  setSelectedListId(null);
                }}
                >
                <Icon name="attach-file" size={24} color="#888" />
              </TouchableOpacity>

              <TextInput
                ref={inputRef}
                style={styles.textInput}
                placeholder="Message"
                placeholderTextColor="#888"
                value={input}
                onChangeText={setInput}
                onFocus={hideOverlay}
              />

              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  setShowListPicker(v => !v);
                  setSelectedListId(null);
                  setAttachMenuVisible(false);
                }}
              >
                <Icon name="playlist-add-check-circle" size={28} color="#888" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  hideOverlay();
                  openCamera();
                }}
              >
                <Icon name="camera-alt" size={24} color="#888" />
              </TouchableOpacity>
            </View>

          <TouchableOpacity onPress={handlePrimaryAction} style={styles.micButton}>
              <Icon
                name={
                  input.trim()
                    ? 'send'
                    : isRecording
                      ? 'stop'
                      : recordedUri
                        ? 'send'
                        : 'mic'
                }
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
       </>
      ) : (
        <View style={styles.missingRoomWrapper}>
          <Icon
            name="chat-bubble-outline"
            size={48}
            color="#1f6ea7"
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.missingRoomTitle}>Chat is syncing…</Text>
          <Text style={styles.missingRoomSubtitle}>
            We&apos;re setting up this conversation. Please return to your chats and try again in a moment.
          </Text>
          <TouchableOpacity
            style={styles.missingRoomButton}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/screens/MocScreen');
            }}
          >
            <Text style={styles.missingRoomButtonText}>Back to chats</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#eef5fa' },

  missingRoomWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  missingRoomTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f6ea7',
    marginBottom: 8,
  },
  missingRoomSubtitle: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
  missingRoomButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#1f6ea7',
  },
  missingRoomButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  deleteModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f1f1f',
    marginBottom: 12,
  },
  deleteModalOption: {
    paddingVertical: 10,
  },
  deleteModalOptionText: {
    fontSize: 16,
    color: '#1f6ea7',
    fontWeight: '500',
  },
  deleteModalCancelText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },

  historyErrorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#fdecea',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  historyErrorText: {
    color: '#b3261e',
    textAlign: 'center',
    fontSize: 13,
  },
  historyLoading: {
    paddingVertical: 24,
    alignItems: 'center',
  },

  header: {
    minHeight: BAR_HEIGHT,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  iconBtn: { padding: 8 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 8,
    backgroundColor: '#e6e6e6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  selectionCount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
    alignSelf: 'center',
  },
  headerActions: { flexDirection: 'row' },
  moreMenuWrapper: { position: 'relative' },
  moreMenu: {
    position: 'absolute',
    top: BAR_HEIGHT,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    paddingVertical: 4,
    minWidth: 140,
    zIndex: 5,
  },
  moreMenuItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  moreMenuText: { color: '#333', fontSize: 14 },
  headerSubtitle: {
    color: '#d8e8f6',
    fontSize: 12,
    marginTop: 2,
  },
  dateSeparatorRow: {
    alignItems: 'center',
    marginVertical: 10,
  },
  dateSeparatorText: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 12,
    color: '#333',
  },
  messageSwipeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  messageSwipeContent: {
    flex: 1,
  },
  replySwipeIconContainer: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  replySwipeIconContainerIncoming: {
    paddingLeft: 2,
  },
  replySwipeIconContainerOutgoing: {
    paddingLeft: 2,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  messageRowIncoming: {
    justifyContent: 'flex-start',
  },
  messageRowOutgoing: {
    justifyContent: 'flex-end',
  },
  selectedRow: {
    backgroundColor: '#8cbbdd',
  },
  bubble: {
    maxWidth: '80%',
    padding: 8,
    borderRadius: 8,
    marginVertical: 4,
  },
  tableBubble: {
    width: '70%',
    maxWidth: '70%',
  },
  myBubble: {
    backgroundColor: '#C8E6C9',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 0,
  },
  theirBubble: {
    backgroundColor: '#ECEFF1',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 0,
  },
  selectedBubble: {
    backgroundColor: '#8cbbdd',
    borderWidth: 1,
    borderColor: '#1f6ea7',
  },
  messageContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  messageText: { fontSize: 16, lineHeight: 20 },
  messageTextwaiting: { fontSize: 12, lineHeight: 10 },
  deletedMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deletedMessageIcon: {
    marginRight: 6,
  },
  deletedMessageText: {
    fontSize: 15,
    color: '#6b6b6b',
    fontStyle: 'italic',
  },
  replyMessageWrapper: {
    flex: 1,
  },
  replyQuoteRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  replyStripe: {
    width: 3,
    borderRadius: 2,
    marginRight: 8,
  },
  replyStripeMine: {
    backgroundColor: '#1f6ea7',
  },
  replyStripeOther: {
    backgroundColor: '#6b7280',
  },
  replyQuoteTextArea: {
    flex: 1,
  },
  replyQuoteTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  replyQuotePreview: {
    fontSize: 12,
    color: '#6b7280',
  },
  messageTextWrapper: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  imageMessageWrapper: {
    alignItems: 'flex-start',
    maxWidth: 250,
  },
  imageSingle: {
    width: 220,
    height: 220,
    borderRadius: 12,
    marginBottom: 6,
  },
  imageGrid: {
    width: 220,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  imageGridItem: {
    width: 106,
    height: 106,
    borderRadius: 8,
    margin: 2,
  },
  locationCard: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 0,
    borderColor: 'transparent',
    minWidth: 200,
  },
  locationMessageWrapper: {
    alignItems: 'flex-start',
  },
  locationMapWrapper: {
    width: 240,
    height: 130,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  locationMapImage: {
    width: '100%',
    height: '100%',
  },
  locationMapPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  locationMapPin: {
    position: 'absolute',
  },
  locationTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  locationTimeText: {
    marginTop: 0,
  },
  tableWrapper: {
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cfd8dc',
    padding: 8,
    alignSelf: 'stretch',
  },
  tableTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2d3d',
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#cfd8dc',
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  tableTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#cfd8dc',
    paddingTop: 6,
    marginTop: 6,
  },
  tableMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  tableTime: {
    fontSize: 10,
  },
  tableCell: {
    fontSize: 13,
    color: '#1f2d3d',
    paddingRight: 6,
  },
  tableHeaderText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  tableIndexCell: {
    flexBasis: '12%',
    flexGrow: 0,
    flexShrink: 0,
  },
  tableItemCell: {
    flexBasis: '45%',
    flexGrow: 1,
    flexShrink: 1,
  },
  tableQtyCell: {
    flexBasis: '28%',
    flexGrow: 1,
    flexShrink: 1,
  },
  tablePriceCell: {
    flexBasis: '15%',
    flexGrow: 0,
    flexShrink: 0,
    textAlign: 'right',
  },
  tableTotalLabel: {
    flexBasis: '85%',
    flexGrow: 1,
    flexShrink: 1,
    fontWeight: '600',
    color: '#0f172a',
  },
  tableTotalValue: {
    fontWeight: '700',
    color: '#0f172a',
  },
  tableRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#a8aaadff',
    paddingBottom: 6,
    marginBottom: 6,
  },
  todoListRows: {
    marginTop: 4,
  },
  todoListRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 2,
  },
  todoListCheckbox: {
    marginRight: 6,
    marginTop: 1,
  },
  todoListRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#999a9bff',
    paddingBottom: 6,
    marginBottom: 6,
  },
  todoListIndex: {
    fontSize: 13,
    color: '#1f2d3d',
    width: 20,
  },
  todoListText: {
    flexShrink: 1,
    fontSize: 13,
    color: '#1f2d3d',
  },
  messageTextFlex: {
    flexShrink: 1,
  },
  waitingBubble: {
    opacity: 0.7,
  },
  deletedBubble: {
    backgroundColor: '#f0f0f0',
  },
  waitingMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  waitingMessageContent: {
    flexShrink: 1,
  },
  waitingMessageIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  waitingMessageText: {
    color: '#475569',
    lineHeight: 18,
  },
  learnMoreLink: {
    color: '#1f6ea7',
    fontWeight: '600',
    fontSize:13,
    textDecorationLine: 'underline',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inlineTime: {
    marginTop: 0,
    marginLeft: 6,
  },
  myTime: { color: '#555' },
  theirTime: { color: '#777' },
  pendingTime: {
    color: '#1f6ea7',
    fontStyle: 'italic',
  },
  failedTime: {
    color: '#b3261e',
  },
  failedBubble: {
    borderWidth: 1,
    borderColor: '#b3261e',
  },

  messageStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  statusTimeInRow: {
    marginTop: 0,
    marginLeft: 0,
  },
  statusIcon: {
    marginLeft: 4,
  },

  listPickerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  arrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#fff',
  },
  listPicker: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 8,
    elevation: 3,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  listBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1f6ea7',
    marginRight: 12,
  },
  listText: { fontSize: 16, color: '#333' },

  todoOverlay: {
    position: 'absolute',
    width: '85%',
    right: 0,
    height: '84%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    elevation: 5,
  },
  todoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  todoHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  previewBtn: {
  padding: 8,
  marginRight: 8,
},

  headerDivider: {
    height: 1,
    backgroundColor: '#333',
    marginHorizontal: 12,
  },

  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  todoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  todoTitle: {
    fontSize: 16,
    color: '#333',
    flexShrink: 1,
  },
  todoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.8,
    justifyContent: 'space-between',
  },
  todoQty: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    color: '#555',
  },
  counter: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ddd',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  counterBtn: { fontSize: 18, width: 24, textAlign: 'right' },
  counterBtn1: { fontSize: 18, width: 24, textAlign: 'left' },
  counterLabel: { fontSize: 14, width: 24, textAlign: 'center' },
  todoPrice: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    color: '#333',
  },
  subContainer: {
    backgroundColor: '#f2f2f2',
    padding: 8,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 6,
  },

  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 40,
    paddingVertical: 6,
  },

  bottomBar: {
    paddingHorizontal: MARGIN,
    paddingTop: MARGIN,
  },
  messageBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: MESSAGE_BAR_HEIGHT,
    borderRadius: MESSAGE_BAR_HEIGHT / 2,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
  },

  micButton: {
    marginLeft: MARGIN,
    backgroundColor: '#1f6ea7',
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconButton: { padding: 6, marginHorizontal: 2 },
  textInput: { flex: 1, fontSize: 16, marginHorizontal: 6, paddingVertical: 0 },

  audioPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#1f6ea7',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
    backgroundColor: '#e7f3fb',
  },
  previewPlayButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  previewDuration: {
    flex: 1,
    color: '#1f6ea7',
    fontWeight: '600',
  },
  previewClose: {
    padding: 4,
    marginLeft: 8,
  },

  audioMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginRight: 12,
  },
  audioDurationText: {
    fontSize: 16,
    color: '#1f6ea7',
    fontWeight: '600',
  },

   replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  replyBarStripe: {
    width: 4,
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#1f6ea7',
    marginRight: 10,
  },
  replyBarBody: {
    flex: 1,
  },
  replyBarTitle: {
    color: '#1f6ea7',
    fontWeight: '700',
    fontSize: 13,
  },
  replyBarSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#374151',
  },
  replyBarClose: {
    padding: 6,
  },

 attachOverlay:{
    ...StyleSheet.absoluteFillObject,
    backgroundColor:'transparent'
  },
      attachGrid:{
    position:'absolute',
    left:16,
    right:16,
    backgroundColor:'#fff',
    borderRadius:8,
    paddingVertical:12,
    flexDirection:'row',
    flexWrap:'wrap',
    justifyContent:'flex-start',
    elevation:4
  },
  attachItem:{
    width:'33%',
    alignItems:'center',
    marginVertical:12,
  },


  attachCircle:{
    width:48,
    height:48,
    borderRadius:24,
    backgroundColor:'#1f6ea7',
    alignItems:'center',
    justifyContent:'center'
  },
  attachLabel:{
    marginTop:4,
    fontSize:12,
    textTransform:'capitalize',
    color:'#333'
  },
});
