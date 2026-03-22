import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { getMessageByIdFromDb } from '../services/database';

const formatTimeline = value => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const Tick = ({ type }) => {
  if (type === 'sent') {
    return <Icon name="check" size={18} color="#7a7a7a" />;
  }
  if (type === 'delivered') {
    return <Icon name="done-all" size={18} color="#7a7a7a" />;
  }
  if (type === 'read') {
    return <Icon name="done-all" size={18} color="#1f6ea7" />;
  }
  return null;
};

export default function MessageInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const messageId = typeof params.messageId === 'string' ? params.messageId : '';
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const row = await getMessageByIdFromDb(messageId);
        if (!cancelled) {
          setMessage(row);
        }
      } catch (err) {
        console.warn('Failed to load message info', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [messageId]);

  const deliveredTime = message?.deliveredAt ?? null;
  const readTime = message?.readAt ?? null;
  const sentTime = message?.sentAt ?? message?.createdAt ?? null;
  const text = message?.plaintext ?? 'Encrypted message';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Message info</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#1f6ea7" />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.messageBubble}>
            <Text style={styles.messageText}>{text}</Text>
            <Text style={styles.messageTime}>{formatTimeline(sentTime)}</Text>
          </View>

          <View style={styles.timelineRow}>
            <View>
              <Text style={styles.timelineTitle}>Delivered</Text>
              <Text style={styles.timelineTime}>{formatTimeline(deliveredTime)}</Text>
            </View>
            <Tick type={deliveredTime ? 'delivered' : 'sent'} />
          </View>

          <View style={styles.timelineRow}>
            <View>
              <Text style={styles.timelineTitle}>Read</Text>
              <Text style={styles.timelineTime}>{formatTimeline(readTime)}</Text>
            </View>
            <Tick type="read" />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  header: {
    height: 56,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  iconBtn: { width: 40, alignItems: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },
  messageBubble: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    backgroundColor: '#dcf8c6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  messageText: { fontSize: 16, color: '#111' },
  messageTime: { marginTop: 6, fontSize: 12, color: '#666', alignSelf: 'flex-end' },
  timelineRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  timelineTime: { marginTop: 4, fontSize: 13, color: '#666' },
});